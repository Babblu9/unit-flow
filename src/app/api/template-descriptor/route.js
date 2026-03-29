import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET /api/template-descriptor
 *
 * Serves the optimized template descriptor JSON.
 * This is a static file that gets cached aggressively — it only changes
 * when we re-parse the template Excel.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'excel', 'templateDescriptor.opt.json');
    const data = await readFile(filePath, 'utf-8');

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (err) {
    console.error('Failed to read template descriptor:', err);
    return NextResponse.json(
      { error: 'Template descriptor not found' },
      { status: 500 }
    );
  }
}
