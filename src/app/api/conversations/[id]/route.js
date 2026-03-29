import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getConversation, updateConversation, deleteConversation } from '@/lib/db/conversations.js';

/**
 * GET /api/conversations/[id] - Get a single conversation
 */
export async function GET(request, { params }) {
  try {
    const { dbUser } = await requireAuth();
    const { id } = await params;
    const convo = await getConversation(id, dbUser.id);
    if (!convo) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ conversation: convo });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/conversations/[id] - Update a conversation
 */
export async function PATCH(request, { params }) {
  try {
    const { dbUser } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const updated = await updateConversation(id, dbUser.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ conversation: updated });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id] - Soft-delete a conversation
 */
export async function DELETE(request, { params }) {
  try {
    const { dbUser } = await requireAuth();
    const { id } = await params;
    const deleted = await deleteConversation(id, dbUser.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
