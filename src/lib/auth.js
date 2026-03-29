import { auth, currentUser } from '@clerk/nextjs/server';
import { upsertUser } from './db/users.js';

/**
 * Get the authenticated user from Clerk and ensure they exist in our DB.
 * Returns { clerkUser, dbUser } or throws a 401 Response.
 */
export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Response(JSON.stringify({ error: 'Unable to fetch user profile' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbUser = await upsertUser({
    clerkId: userId,
    email: clerkUser?.emailAddresses?.[0]?.emailAddress || '',
    firstName: clerkUser?.firstName || null,
    lastName: clerkUser?.lastName || null,
    avatarUrl: clerkUser?.imageUrl || null,
  });

  return { clerkUser, dbUser };
}

/**
 * Optional auth \u2014 returns null dbUser if not logged in.
 */
export async function optionalAuth() {
  try {
    return await requireAuth();
  } catch {
    return { clerkUser: null, dbUser: null };
  }
}
