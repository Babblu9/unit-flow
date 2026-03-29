import { NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { requireAuth } from '@/lib/auth.js';
import { createConversation, getConversation, updateConversation } from '@/lib/db/conversations.js';
import { buildSystemPrompt, DRAFT_GENERATION_PROMPT } from '@/lib/ai/prompts.js';
import { UnitEconomicsDraftSchema } from '@/lib/ai/schemas.js';

/* ── AI client (Vercel AI Gateway) ── */
const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1',
});

const MODEL = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o';

/* ── Step sequence ── */
const STEP_ORDER = [
  'understand_business',
  'company_details',
  'products_services',
  'team_structure',
  'costs_and_investment',
  'auto_draft',
  'confirm_review',
  'complete',
];

/* ── Compute completion % ── */
function computeCompletion(step) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STEP_ORDER.length) * 100);
}

/* ── Extract [DATA: {...}] tags from AI response ── */
function extractDataTags(text) {
  const dataTags = [];
  const regex = /\[DATA:\s*(\{[\s\S]*?\})\s*\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      dataTags.push(JSON.parse(match[1]));
    } catch (e) {
      console.warn('Failed to parse DATA tag:', match[1]);
    }
  }
  return dataTags;
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

/* ── Merge user message data into knowledge graph ── */
function mergeIntoKG(kg, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      kg[key] = value;
    }
  }
  return kg;
}

/* ── Determine next step based on what we know ── */
function nextStep(currentStep, kg) {
  const idx = STEP_ORDER.indexOf(currentStep);
  if (idx < 0) return STEP_ORDER[0];

  // Check if we can auto-advance
  if (currentStep === 'understand_business') {
    if (kg.companyName && kg.businessDescription) {
      return 'company_details';
    }
  }
  if (currentStep === 'company_details') {
    if (kg.businessStage && kg.city) {
      return 'products_services';
    }
  }
  if (currentStep === 'products_services') {
    if (kg.productsServices || (kg.products && kg.products.length > 0)) {
      return 'team_structure';
    }
  }
  if (currentStep === 'team_structure') {
    if (kg.teamSize || (kg.employees && kg.employees.length > 0)) {
      return 'costs_and_investment';
    }
  }
  if (currentStep === 'costs_and_investment') {
    // Move to auto-draft after costs
    return 'auto_draft';
  }
  if (currentStep === 'auto_draft') {
    return 'confirm_review';
  }
  if (currentStep === 'confirm_review') {
    return 'complete';
  }

  // Default: stay on current step
  return currentStep;
}

/* ── Parse user input for business data ── */
function parseUserInput(message, currentStep) {
  const data = {};
  const text = message.trim();

  // Business stage detection
  const stageMap = {
    'idea': 'idea',
    'early': 'early',
    'growth': 'growth',
    'scale': 'scale',
    '0-6': 'early',
    '6-24': 'growth',
    '24+': 'scale',
  };
  for (const [keyword, stage] of Object.entries(stageMap)) {
    if (text.toLowerCase().includes(keyword)) {
      data.businessStage = stage;
      break;
    }
  }

  // Money parsing (INR)
  const moneyRegex = /[\u20B9₹]?\s*([\d,]+(?:\.\d+)?)\s*(?:lakh|lac|L)/gi;
  let moneyMatch;
  const amounts = [];
  while ((moneyMatch = moneyRegex.exec(text)) !== null) {
    amounts.push(parseFloat(moneyMatch[1].replace(/,/g, '')) * 100000);
  }

  const croreRegex = /[\u20B9₹]?\s*([\d,]+(?:\.\d+)?)\s*(?:crore|cr)/gi;
  while ((moneyMatch = croreRegex.exec(text)) !== null) {
    amounts.push(parseFloat(moneyMatch[1].replace(/,/g, '')) * 10000000);
  }

  const plainRegex = /[\u20B9₹]\s*([\d,]+(?:\.\d+)?)/g;
  while ((moneyMatch = plainRegex.exec(text)) !== null) {
    const val = parseFloat(moneyMatch[1].replace(/,/g, ''));
    if (val > 100) amounts.push(val); // Skip tiny amounts
  }

  // Assign amounts based on context/step
  if (currentStep === 'costs_and_investment' && amounts.length > 0) {
    if (text.toLowerCase().includes('rent')) data.monthlyRent = amounts[0];
    if (text.toLowerCase().includes('invest')) data.investmentAmount = amounts[0];
    if (text.toLowerCase().includes('loan') || text.toLowerCase().includes('borrow')) data.loansBorrowings = amounts[0];
    if (text.toLowerCase().includes('profit') || text.toLowerCase().includes('target')) data.profitTarget = amounts[0];
  }

  // Team size parsing
  const teamMatch = text.match(/(\d+)\s*(?:people|employees|team|members|staff)/i);
  if (teamMatch) {
    data.teamSize = parseInt(teamMatch[1]);
  }

  // City parsing (common Indian cities)
  const indianCities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai',
    'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'surat', 'kochi', 'indore',
    'chandigarh', 'nagpur', 'patna', 'bhopal', 'visakhapatnam', 'coimbatore'];
  for (const city of indianCities) {
    if (text.toLowerCase().includes(city)) {
      data.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  return data;
}

/* ── Main POST handler ── */
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
    let currentStep = meta.step || reqStep || 'understand_business';
    let msgs = convo.messages || [];

    // Add user message
    msgs.push({ role: 'user', text: message, timestamp: Date.now() });

    // Parse user input and merge into knowledge graph
    const parsed = parseUserInput(message, currentStep);
    kg = mergeIntoKG(kg, parsed);

    // If user provided company name in first message, extract it
    if (currentStep === 'understand_business' && !kg.companyName) {
      // Try to extract company name from first substantial noun phrase
      kg.businessDescription = message;
    }

    // Determine if we should advance step
    const prevStep = currentStep;
    currentStep = nextStep(currentStep, kg);

    let aiResponse;
    let draft = null;

    // ── Auto-draft step: generate full model via structured output ──
    if (currentStep === 'auto_draft') {
      try {
        const draftPrompt = `${DRAFT_GENERATION_PROMPT}\n\n## Business Context:\n${JSON.stringify(kg, null, 2)}`;

        const { object } = await generateObject({
          model: openai(MODEL),
          schema: UnitEconomicsDraftSchema,
          prompt: draftPrompt,
          system: buildSystemPrompt('auto_draft', kg),
        });

        draft = object;

        // Merge draft data back into KG
        kg.draft = draft;
        kg.companyName = draft.companyName || kg.companyName;
        kg.industry = draft.industry || kg.industry;

        // Generate a summary message
        const { text: summaryText } = await generateText({
          model: openai(MODEL),
          system: buildSystemPrompt('confirm_review', kg),
          prompt: `You just generated a complete Unit Economics model for "${kg.companyName || 'the business'}". 
Summarize what was generated:
- ${draft.employees?.length || 0} team members across ${new Set(draft.employees?.map(e => e.department) || []).size} departments
- ${draft.products?.length || 0} products/services
- ${draft.marketingChannels?.length || 0} marketing channels
- ${draft.adminExpenses?.length || 0} admin expense items
- ${draft.capexItems?.length || 0} CAPEX items
- ${draft.loans?.length || 0} loan(s)
- ${draft.cities?.length || 0} cities for geo pricing

Ask them to review and confirm, or make changes.`,
        });

        aiResponse = summaryText;
        currentStep = 'confirm_review';

      } catch (err) {
        console.error('Draft generation failed:', err);
        aiResponse = `I encountered an issue generating the full model. Let me try a simpler approach. Could you confirm the key details?\n\n[SUGGESTIONS: ["Try again", "Let me provide more details"]]`;
        currentStep = prevStep; // Stay on previous step
      }
    } else {
      // ── Normal conversational step ──
      const systemPrompt = buildSystemPrompt(currentStep, kg);

      // Build message history for context (last 20 messages)
      const historyForLLM = msgs.slice(-20).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const { text: responseText } = await generateText({
        model: openai(MODEL),
        system: systemPrompt,
        messages: historyForLLM,
      });

      aiResponse = responseText;

      // Extract any DATA tags from AI response
      const dataTags = extractDataTags(aiResponse);
      for (const data of dataTags) {
        kg = mergeIntoKG(kg, data);
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

    // Save conversation
    await updateConversation(convo.id, dbUser.id, {
      messages: msgs,
      agentMeta: {
        knowledgeGraph: kg,
        step: currentStep,
        draft,
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
      draft: draft ? {
        employeeCount: draft.employees?.length,
        productCount: draft.products?.length,
        channelCount: draft.marketingChannels?.length,
        cityCount: draft.cities?.length,
      } : null,
      screenPhase,
    });

  } catch (err) {
    // Handle auth throws
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
