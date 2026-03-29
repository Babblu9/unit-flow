import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';

/**
 * POST /api/upload — Handle file uploads (pitch decks, financial docs, etc.)
 *
 * Accepts multipart form data with a single file field.
 * Returns the file's text content (for PDFs/docs, returns raw text extraction;
 * for images, returns a placeholder). The extracted text is then used by
 * the agent-chat route to enrich the knowledge graph.
 *
 * In production, you'd use a proper document parser (pdf-parse, mammoth, etc.).
 * For now, we support .txt, .csv, and return file metadata for other types.
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export async function POST(request) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Supported: txt, csv, pdf, docx, xlsx, images` },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    let extractedText = '';

    // Extract text content based on file type
    if (fileType === 'text/plain' || fileType === 'text/csv') {
      const buffer = await file.arrayBuffer();
      extractedText = new TextDecoder('utf-8').decode(buffer);
      // Truncate very long text files
      if (extractedText.length > 50000) {
        extractedText = extractedText.substring(0, 50000) + '\n\n[... truncated, file too long ...]';
      }
    } else if (fileType === 'application/pdf') {
      // For PDF, we'd use pdf-parse in production. For now, return metadata.
      extractedText = `[PDF Document: "${fileName}", ${(fileSize / 1024).toFixed(1)}KB. Full text extraction requires pdf-parse integration.]`;
    } else if (fileType.startsWith('application/vnd.openxmlformats') || fileType === 'application/vnd.ms-excel') {
      extractedText = `[Office Document: "${fileName}", ${(fileSize / 1024).toFixed(1)}KB. Full text extraction requires mammoth/exceljs integration.]`;
    } else if (fileType.startsWith('image/')) {
      extractedText = `[Image: "${fileName}", ${(fileSize / 1024).toFixed(1)}KB. Image analysis requires vision model integration.]`;
    }

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        type: fileType,
        size: fileSize,
        extractedText,
      },
    });

  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
