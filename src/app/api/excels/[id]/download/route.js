import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getExcel } from '@/lib/db/excels.js';

/**
 * GET /api/excels/[id]/download - Download an Excel file from DB
 */
export async function GET(request, { params }) {
  try {
    const { dbUser } = await requireAuth();
    const { id } = await params;
    const excel = await getExcel(id, dbUser.id);

    if (!excel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new Response(excel.fileData, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${excel.fileName}"`,
        'Content-Length': excel.fileData.length.toString(),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
