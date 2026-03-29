import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getExcels } from '@/lib/db/excels.js';

/**
 * GET /api/excels - List user's generated Excel files (metadata only)
 */
export async function GET() {
  try {
    const { dbUser } = await requireAuth();
    const excels = await getExcels(dbUser.id);
    return NextResponse.json({ excels });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
