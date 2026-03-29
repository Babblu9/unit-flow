import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';
import { getConversations, createConversation } from '@/lib/db/conversations.js';

/**
 * GET /api/conversations - List user's conversations
 */
export async function GET() {
  try {
    const { dbUser } = await requireAuth();
    const conversations = await getConversations(dbUser.id);
    return NextResponse.json({ conversations });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/conversations - Create a new conversation
 */
export async function POST(request) {
  try {
    const { dbUser } = await requireAuth();
    const body = await request.json();
    const convo = await createConversation(dbUser.id, body);
    return NextResponse.json({ conversation: convo });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
