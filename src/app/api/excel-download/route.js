import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getConversation } from '@/lib/db/conversations.js';
import { generateWorkbook } from '@/lib/excel/templateBuilder.js';
import { saveExcel } from '@/lib/db/excels.js';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/excel-download
 * Generates the 17-sheet Excel workbook from the draft and returns it for download.
 * Also saves a copy to the DB and to /tmp for subsequent patching.
 *
 * Body: { conversationId }
 */
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

    // Generate workbook
    const wb = await generateWorkbook(draft);

    // Write to /tmp for future patching
    const tmpPath = path.join('/tmp', `unit_economics_${conversationId}.xlsx`);
    await wb.xlsx.writeFile(tmpPath);

    // Read back as buffer for DB storage and download
    const buffer = await wb.xlsx.writeBuffer();

    // Save to DB
    const companyName = draft.companyName || 'Company';
    const fileName = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_UnitEconomics.xlsx`;

    await saveExcel({
      userId: dbUser.id,
      conversationId,
      fileName,
      fileData: Buffer.from(buffer),
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
