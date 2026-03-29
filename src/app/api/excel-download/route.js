import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getConversation } from '@/lib/db/conversations.js';
import { generateWorkbook } from '@/lib/excel/templateBuilder.js';
import { saveExcel } from '@/lib/db/excels.js';

/**
 * POST /api/excel-download
 *
 * Generates a complete 17-sheet Unit Economics Excel workbook from the AI draft
 * using the programmatic templateBuilder (no external template file needed).
 * All formulas are generated in code — no stale data, no bleed-through.
 *
 * Body: { conversationId }
 */
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { dbUser } = await requireAuth();
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const convo = await getConversation(conversationId, dbUser.id);
    if (!convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const draft = convo.agentMeta?.draft;
    if (!draft) {
      return NextResponse.json({ error: 'No model draft found. Complete the chat first.' }, { status: 400 });
    }

    // Generate the workbook from scratch using templateBuilder
    const wb = await generateWorkbook(draft);

    // Write to buffer
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    // Save to DB
    const companyName = draft.companyName || 'Company';
    const fileName = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_UnitFlow.xlsx`;

    await saveExcel({
      userId: dbUser.id,
      conversationId,
      fileName,
      fileData: buffer,
      modelSnapshot: draft,
    });

    // Return as download
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });

  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Excel download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
