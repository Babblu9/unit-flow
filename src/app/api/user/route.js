import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth.js';

/**
 * GET /api/user - Get current user info
 */
export async function GET() {
  try {
    const { dbUser, clerkUser } = await requireAuth();
    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        avatarUrl: dbUser.avatarUrl,
        plan: dbUser.plan,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
