import { NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { requireAuth } from '@/lib/auth.js';
import { createConversation, getConversation, updateConversation } from '@/lib/db/conversations.js';
import { buildSystemPrompt, DRAFT_GENERATION_PROMPT, EXTRACTION_PROMPT, EDIT_PROMPT } from '@/lib/ai/prompts.js';
import { UnitEconomicsDraftSchema, BusinessExtractionSchema } from '@/lib/ai/schemas.js';
import { searchBusinessContext, formatEnrichmentForPrompt } from '@/lib/exa/search.js';

/* ── Increase serverless function timeout to 120s ── */
export const maxDuration = 120;

/* ── AI client (Vercel AI Gateway) ──
 * IMPORTANT: Use openai.chat() to force the Chat Completions API.
 * @ai-sdk/openai v3+ defaults to the Responses API (openai.responses),
 * which the Vercel AI Gateway proxy does not support.
 */
const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1',
});

const MODEL_ID = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o';
const model = openai.chat(MODEL_ID);

/* ── Streamlined step sequence ── */
const STEP_ORDER = [
  'extract',        // Smart extraction from first message
  'fill_gaps',      // ONE consolidated gap-fill question (skippable)
  'generate',       // Full draft generation
  'confirm_review', // User reviews the model
  'complete',       // Done
];

/* ── Compute completion % ── */
function computeCompletion(step) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STEP_ORDER.length) * 100);
}

/* ── Clean AI text for display (strip tags) ── */
function cleanForDisplay(text) {
  return text
    .replace(/\[DATA:\s*\{[\s\S]*?\}\s*\]/g, '')
    .replace(/\[SUGGESTIONS:\s*\[[\s\S]*?\]\s*\]/g, '')
    .replace(/\[SHEET:\s*"[^"]*"\s*\]/g, '')
    .trim();
}

/* ── Extract [SUGGESTIONS: [...]] ── */
function extractSuggestions(text) {
  const match = text.match(/\[SUGGESTIONS:\s*(\[[\s\S]*?\])\s*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

/* ── Extract [SHEET: "..."] ── */
function extractSheetNav(text) {
  const match = text.match(/\[SHEET:\s*"([^"]*)"\s*\]/);
  return match ? match[1] : null;
}

/* ── Merge extraction data into knowledge graph ── */
function mergeExtractionIntoKG(kg, extraction) {
  const fields = [
    'companyName', 'businessDescription', 'productsServices',
    'targetCustomer', 'city', 'businessStage', 'teamInfo',
    'monthlyRevenue', 'investmentAmount', 'monthlyRent',
    'profitTarget', 'loanInfo', 'costInfo',
  ];
  for (const field of fields) {
    const val = extraction[field];
    if (val !== undefined && val !== null && val !== '' &&
        !(Array.isArray(val) && val.length === 0)) {
      kg[field] = val;
    }
  }
  kg.confidenceScore = extraction.confidenceScore;
  kg.missingCritical = extraction.missingCritical;
  return kg;
}

/* ── Detect meta-commands (not real business content) ── */
const META_PHRASES = ['try again', 'retry', 'let me try', 'start over'];
function isMetaCommand(text) {
  const lower = text.trim().toLowerCase();
  return lower.length < 30 && META_PHRASES.some(p => lower.includes(p));
}

/* ── Find the last substantive user message from history ── */
function findLastSubstantiveMessage(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'user' && m.text && m.text.length > 30 && !isMetaCommand(m.text)) {
      return m.text;
    }
  }
  return null;
}

/* ── Detect skip/go-ahead intent ── */
const SKIP_PHRASES = ['go ahead', 'use defaults', 'skip', 'just generate', 'proceed', 'defaults'];
function isSkipCommand(text) {
  return SKIP_PHRASES.some(p => text.toLowerCase().includes(p));
}

/* ═══════════════════════════════════════════════════════════
   generateObject with retry + fallback
   ═══════════════════════════════════════════════════════════ */
async function generateObjectSafe(params, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await generateObject(params);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`generateObject attempt ${attempt + 1} failed:`, err.message);
      if (attempt < retries) {
        // Brief pause before retry (500ms, 1500ms)
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/* ═══════════════════════════════════════════════════════════
   STEP HANDLERS
   ═══════════════════════════════════════════════════════════ */

/**
 * STEP: extract
 * Use generateObject() with BusinessExtractionSchema to extract all fields.
 * If generateObject fails, falls back to minimal extraction.
 */
async function handleExtract(message, kg) {
  let extraction;
  try {
    const { object } = await generateObjectSafe({
      model: model,
      schema: BusinessExtractionSchema,
      system: buildSystemPrompt('extract'),
      prompt: `${EXTRACTION_PROMPT}\n\nUser message:\n"${message}"`,
    }, 1); // 1 retry
    extraction = object;
  } catch (err) {
    console.error('Extraction generateObject failed after retries:', err.message);
    // Fallback: store the raw message as business description,
    // set low confidence so we go to fill_gaps
    extraction = {
      companyName: null,
      businessDescription: message.substring(0, 1000),
      productsServices: [],
      targetCustomer: null,
      city: null,
      businessStage: null,
      teamInfo: null,
      monthlyRevenue: null,
      investmentAmount: null,
      monthlyRent: null,
      profitTarget: null,
      loanInfo: null,
      costInfo: null,
      confidenceScore: 0.4,
      missingCritical: ['product/service details', 'city/location', 'business stage'],
    };
  }

  mergeExtractionIntoKG(kg, extraction);

  const confidence = extraction.confidenceScore || 0;
  const missing = extraction.missingCritical || [];

  if (confidence >= 0.7 || missing.length === 0) {
    return { nextStep: 'generate', kg };
  }

  return { nextStep: 'fill_gaps', kg };
}

/**
 * STEP: fill_gaps
 * User replied to gap-fill or said "go ahead".
 * Re-extract from their reply, then move to generate.
 */
async function handleFillGaps(message, kg) {
  if (!isSkipCommand(message)) {
    // Re-extract from the gap-fill reply to capture new info
    try {
      const { object: extraction } = await generateObjectSafe({
        model: model,
        schema: BusinessExtractionSchema,
        system: buildSystemPrompt('extract'),
        prompt: `${EXTRACTION_PROMPT}\n\nPrevious context:\n${JSON.stringify(kg, null, 2)}\n\nUser's follow-up with additional details:\n"${message}"`,
      }, 1);
      mergeExtractionIntoKG(kg, extraction);
    } catch (err) {
      console.warn('Re-extraction failed, proceeding with existing data:', err.message);
    }
  }

  return { nextStep: 'generate', kg };
}

/**
 * STEP: generate
 * Generate the full draft. Includes Exa search enrichment.
 */
async function handleGenerate(kg) {
  // Enrich KG with real industry data from Exa search
  let enrichmentText = '';
  try {
    const enrichment = await searchBusinessContext(kg);
    if (enrichment && Object.keys(enrichment).length > 0) {
      kg.webResearch = enrichment;
      enrichmentText = formatEnrichmentForPrompt(enrichment);
    }
  } catch (exaErr) {
    console.warn('Exa enrichment skipped:', exaErr.message);
  }

  // Strip large fields from KG to keep prompt size manageable
  const kgForPrompt = { ...kg };
  delete kgForPrompt.draft;
  delete kgForPrompt.webResearch;

  let draftPrompt = `${DRAFT_GENERATION_PROMPT}\n\n## Business Context:\n${JSON.stringify(kgForPrompt, null, 2)}`;
  if (enrichmentText) {
    draftPrompt += `\n\n## Real Industry Data (from web research \u2014 use these to calibrate your numbers):\n${enrichmentText}`;
  }

  const { object: draft } = await generateObjectSafe({
    model: model,
    schema: UnitEconomicsDraftSchema,
    prompt: draftPrompt,
    system: buildSystemPrompt('generate', kgForPrompt),
  }, 2); // 2 retries for draft generation

  // Merge draft data back into KG
  kg.draft = draft;
  kg.companyName = draft.companyName || kg.companyName;
  kg.industry = draft.industry || kg.industry;

  // Generate a summary message
  const costSuggestionsPreview = (draft.costSuggestions || []).slice(0, 3).map(s =>
    `  - **${s.title}**: ${s.description?.substring(0, 80) || ''} (save \u20B9${(s.monthlySavings || 0).toLocaleString('en-IN')}/mo)`
  ).join('\n');
  const totalPotentialSavings = (draft.costSuggestions || []).reduce((sum, s) => sum + (s.monthlySavings || 0), 0);

  const { text: summaryText } = await generateText({
    model: model,
    system: buildSystemPrompt('confirm_review', kgForPrompt),
    prompt: `You just generated a complete Unit Economics model for "${kg.companyName || 'the business'}".
Summarize what was generated in a concise bullet list:
- ${draft.employees?.length || 0} team members across ${new Set(draft.employees?.map(e => e.department) || []).size} departments
- ${draft.products?.length || 0} products/services (with detailed cost breakdowns)
- ${draft.marketingChannels?.length || 0} marketing channels (AI-generated)
- ${draft.adminExpenses?.length || 0} admin expense items
- ${draft.capexItems?.length || 0} CAPEX items
- ${draft.loans?.length || 0} loan(s)
- ${draft.cities?.length || 0} cities for geo pricing
- Profit target: \u20B9${(draft.profitTargets?.targetMonthlyProfit || 0).toLocaleString('en-IN')}/month${draft.profitTargets?.rationale ? ` (${draft.profitTargets.rationale})` : ''}

After the model summary, introduce the cost optimization suggestions conversationally. Say something like:
"I also found **${draft.costSuggestions?.length || 0} ways to optimize your costs** (potential savings: \u20B9${totalPotentialSavings.toLocaleString('en-IN')}/month). You can review each suggestion below \u2014 tap to expand, then **Apply** or **Skip** each one."

DO NOT list the individual suggestions in the text \u2014 they will be rendered as interactive cards below your message automatically. Just mention the count and total savings.

Ask them to review the suggestions and confirm, or make changes. Keep it under 10 lines.`,
  });

  return { aiResponse: summaryText, nextStep: 'confirm_review', draft, kg };
}

/**
 * Normal conversational handling for post-draft interactions.
 */
async function handleConversational(step, message, kg, msgs) {
  const systemPrompt = buildSystemPrompt(step, kg);

  const historyForLLM = msgs.slice(-20).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const { text: responseText } = await generateText({
    model: model,
    system: systemPrompt,
    messages: historyForLLM,
  });

  return { aiResponse: responseText, nextStep: step, kg };
}

/**
 * EDIT HANDLER: User requests changes to an existing draft.
 * Takes the current draft + user's edit request, returns a fully updated draft.
 * Pattern follows handleGenerate() but uses EDIT_PROMPT instead of DRAFT_GENERATION_PROMPT.
 */
async function handleEdit(message, kg) {
  const currentDraft = kg.draft;
  if (!currentDraft) {
    // No draft to edit \u2014 fall back to conversational
    return { aiResponse: 'I don\u2019t have a model to edit yet. Please describe your business first so I can generate one.', nextStep: kg.step || 'extract', kg, draft: null };
  }

  const editPrompt = `${EDIT_PROMPT}\n\n## Current Draft:\n\`\`\`json\n${JSON.stringify(currentDraft, null, 2)}\n\`\`\`\n\n## User's Edit Request:\n"${message}"`;

  const { object: updatedDraft } = await generateObjectSafe({
    model: model,
    schema: UnitEconomicsDraftSchema,
    prompt: editPrompt,
    system: buildSystemPrompt('confirm_review', kg),
  }, 2); // 2 retries

  // Update KG with new draft
  kg.draft = updatedDraft;
  kg.companyName = updatedDraft.companyName || kg.companyName;
  kg.industry = updatedDraft.industry || kg.industry;

  // Generate a concise summary of what changed
  const { text: summaryText } = await generateText({
    model: model,
    system: `You are a helpful financial analyst. Summarize the changes made to the model in 2\u20134 bullet points. Be specific about what numbers changed. Use \u20B9 for INR amounts.`,
    prompt: `The user asked: "${message}"\n\nThe model has been updated. Summarize what changed concisely.\n\nThen ask if they want to make more changes or download the Excel.\n\n[SUGGESTIONS: ["Looks good, download Excel!", "Make more changes", "Show me the updated model"]]`,
  });

  return { aiResponse: summaryText, nextStep: 'confirm_review', draft: updatedDraft, kg };
}

/* ══════════════════════════════════════════════════════
   Main POST handler
   ══════════════════════════════════════════════════════ */
export async function POST(request) {
  try {
    const { dbUser } = await requireAuth();
    const body = await request.json();
    const { message, conversationId: reqConvoId, step: reqStep } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Load or create conversation
    let convo;
    if (reqConvoId) {
      convo = await getConversation(reqConvoId, dbUser.id);
    }
    if (!convo) {
      convo = await createConversation(dbUser.id, {
        title: message.substring(0, 60),
        stage: 'discovery',
      });
    }

    // Restore state
    const meta = convo.agentMeta || {};
    let kg = meta.knowledgeGraph || {};
    let currentStep = meta.step || reqStep || 'extract';
    let msgs = convo.messages || [];

    // Add user message
    msgs.push({ role: 'user', text: message, timestamp: Date.now() });

    let aiResponse = '';
    let draft = null;

    try {
      // ── Route to the correct step handler ──
      if (currentStep === 'extract') {
        /* ── STEP 1: Smart extraction ──
         * If user sent a meta-command like "Try again", find the
         * last substantive message from history and extract from that.
         */
        let extractMessage = message;
        if (isMetaCommand(message)) {
          const prev = findLastSubstantiveMessage(msgs);
          if (prev) {
            extractMessage = prev;
          }
        }

        const result = await handleExtract(extractMessage, kg);
        kg = result.kg;

        if (result.nextStep === 'generate') {
          // Confidence is high \u2014 skip gap-fill, go straight to generation
          const { text: ackText } = await generateText({
            model: model,
            system: buildSystemPrompt('generate', kg),
            prompt: `The user described their business: "${extractMessage.substring(0, 500)}"\n\nYou extracted enough info (confidence: ${kg.confidenceScore}). Briefly acknowledge what you understood (2-3 lines max) and say you're now generating their 17-sheet Unit Economics model. Do NOT ask any questions.`,
          });

          // Generate the full draft
          const genResult = await handleGenerate(kg);
          aiResponse = ackText + '\n\n---\n\n' + genResult.aiResponse;
          draft = genResult.draft;
          kg = genResult.kg;
          currentStep = genResult.nextStep;
        } else {
          // Need gap-fill
          const { text: gapText } = await generateText({
            model: model,
            system: buildSystemPrompt('fill_gaps', kg),
            prompt: `You extracted this from the user's message:\n${JSON.stringify({
              companyName: kg.companyName, businessDescription: kg.businessDescription,
              productsServices: kg.productsServices, city: kg.city,
              businessStage: kg.businessStage, confidenceScore: kg.confidenceScore,
            }, null, 2)}\n\nMissing critical items: ${(kg.missingCritical || []).join(', ')}\nConfidence: ${kg.confidenceScore}\n\nAsk ONE consolidated follow-up (max 3 numbered questions). Be brief.`,
          });
          aiResponse = gapText;
          currentStep = 'fill_gaps';
        }

      } else if (currentStep === 'fill_gaps') {
        /* ── STEP 2: User answered gap-fill or said "go ahead" ── */
        const result = await handleFillGaps(message, kg);
        kg = result.kg;

        // Now generate the full draft
        const genResult = await handleGenerate(kg);
        aiResponse = genResult.aiResponse;
        draft = genResult.draft;
        kg = genResult.kg;
        currentStep = genResult.nextStep;

      } else if (currentStep === 'generate') {
        /* ── STEP 2.5: Retry generation (if previous generate failed) ── */
        const genResult = await handleGenerate(kg);
        aiResponse = genResult.aiResponse;
        draft = genResult.draft;
        kg = genResult.kg;
        currentStep = genResult.nextStep;

      } else if (currentStep === 'confirm_review') {
        const downloadPhrases = ['download', 'looks good', 'generate excel', 'perfect', 'done'];
        const wantsDownload = downloadPhrases.some(p => message.toLowerCase().includes(p));

        if (wantsDownload) {
          aiResponse = `Your **17-sheet Unit Economics model** is ready! Click the **Download Excel** button below to get your file.\n\nYou can also continue chatting to adjust any section.\n\n[SUGGESTIONS: ["Download Excel", "Adjust HR costs", "Change margins", "Start new model"]]`;
          currentStep = 'complete';
        } else {
          // Route to handleEdit — user wants to change the model
          const editResult = await handleEdit(message, kg);
          aiResponse = editResult.aiResponse;
          kg = editResult.kg;
          if (editResult.draft) {
            draft = editResult.draft;
          }
          currentStep = editResult.nextStep;
        }

      } else if (currentStep === 'complete') {
        const downloadPhrases = ['download', 'generate excel', 'get my file', 'excel'];
        const wantsDownload = downloadPhrases.some(p => message.toLowerCase().includes(p));
        const newModelPhrases = ['start new', 'new model', 'start over', 'fresh'];
        const wantsNewModel = newModelPhrases.some(p => message.toLowerCase().includes(p));

        if (wantsDownload) {
          aiResponse = `Click the **Download Excel** button above to get your file!\n\n[SUGGESTIONS: ["Download Excel", "Make more changes", "Start new model"]]`;
        } else if (wantsNewModel) {
          aiResponse = `Sure! Describe your new business and I\u2019ll build a fresh Unit Economics model.\n\n[SUGGESTIONS: ["Cloud kitchen in Delhi", "SaaS startup in Bangalore", "Retail store in Pune"]]`;
          currentStep = 'extract';
          kg = {}; // Reset knowledge graph for new model
        } else {
          // Route to handleEdit — user wants to change the model
          const editResult = await handleEdit(message, kg);
          aiResponse = editResult.aiResponse;
          kg = editResult.kg;
          if (editResult.draft) {
            draft = editResult.draft;
          }
          currentStep = editResult.nextStep;
        }

      } else {
        // Unknown step \u2014 fall back to extract
        currentStep = 'extract';
        const result = await handleExtract(message, kg);
        kg = result.kg;
        if (result.nextStep === 'generate') {
          const genResult = await handleGenerate(kg);
          aiResponse = genResult.aiResponse;
          draft = genResult.draft;
          kg = genResult.kg;
          currentStep = genResult.nextStep;
        } else {
          const { text: gapText } = await generateText({
            model: model,
            system: buildSystemPrompt('fill_gaps', kg),
            prompt: `Missing: ${(kg.missingCritical || []).join(', ')}\nConfidence: ${kg.confidenceScore}\nAsk ONE consolidated follow-up. Be brief.`,
          });
          aiResponse = gapText;
          currentStep = 'fill_gaps';
        }
      }
    } catch (stepErr) {
      console.error(`Step "${currentStep}" failed:`, stepErr);

      // If generation failed, park at 'generate' step so user can retry
      // without re-doing extraction
      if (currentStep === 'fill_gaps' || currentStep === 'generate') {
        currentStep = 'generate';
        aiResponse = `I\u2019m having trouble generating the full model right now. This can happen with complex models.\n\nLet me try again \u2014 just say **"generate"** or provide any additional details.\n\n[SUGGESTIONS: ["Generate my model", "Let me add more details"]]`;
      } else {
        aiResponse = `I encountered an issue. Let me try again \u2014 could you rephrase or provide more details?\n\n**Error:** ${stepErr.message?.substring(0, 150) || 'Unknown error'}\n\n[SUGGESTIONS: ["Try again", "Let me provide more details"]]`;
      }
    }

    // Extract display components
    const suggestions = extractSuggestions(aiResponse);
    const sheetNav = extractSheetNav(aiResponse);
    const displayText = cleanForDisplay(aiResponse);

    // Add AI response to messages
    msgs.push({
      role: 'assistant',
      text: aiResponse,
      displayText,
      suggestions,
      sheetNav,
      timestamp: Date.now(),
    });

    // Compute completion
    const completionPct = computeCompletion(currentStep);

    // Determine screen phase
    let screenPhase = 'chatting';
    if (currentStep === 'complete') screenPhase = 'complete';
    if (draft) screenPhase = 'review';

    // Build modelState from draft for frontend hydration
    const modelState = draft ? {
      businessInfo: {
        companyName: draft.companyName || kg.companyName || '',
        businessDescription: kg.businessDescription || '',
        productsServices: kg.productsServices || '',
        targetCustomer: kg.targetCustomer || '',
        city: kg.city || '',
        businessStage: kg.businessStage || '',
        teamSize: String(draft.employees?.length || ''),
        monthlyRevenue: String(kg.monthlyRevenue || ''),
        investmentAmount: String(kg.investmentAmount || ''),
        monthlyRent: String(kg.monthlyRent || ''),
        profitTarget: String(draft.profitTargets?.targetMonthlyProfit || kg.profitTarget || ''),
        loansBorrowings: String(kg.loansBorrowings || ''),
      },
      employees: draft.employees || [],
      marketingChannels: draft.marketingChannels || [],
      products: draft.products || [],
      cities: draft.cities || [],
      adminExpenses: draft.adminExpenses || [],
      capexItems: draft.capexItems || [],
      loans: draft.loans || [],
      ltvParams: draft.ltvParams || null,
      scenarios: draft.scenarios || null,
      profitTargets: draft.profitTargets || null,
      costSuggestions: draft.costSuggestions || [],
    } : null;

    // Save conversation
    await updateConversation(convo.id, dbUser.id, {
      messages: msgs,
      modelState,
      agentMeta: {
        knowledgeGraph: kg,
        step: currentStep,
        draft: draft || meta.draft || null,
      },
      stage: currentStep === 'complete' ? 'complete' : 'building',
      completion: completionPct,
      screenPhase,
      title: kg.companyName ? `${kg.companyName} \u2014 Unit Economics` : convo.title,
    });

    return NextResponse.json({
      conversationId: convo.id,
      message: displayText,
      suggestions,
      sheetNav,
      step: currentStep,
      completion: completionPct,
      draftData: modelState,
      rawDraft: draft || null,
      draft: draft ? {
        employeeCount: draft.employees?.length,
        productCount: draft.products?.length,
        channelCount: draft.marketingChannels?.length,
        cityCount: draft.cities?.length,
      } : null,
      costSuggestions: draft?.costSuggestions || null,
      screenPhase,
    });

  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Agent chat error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
