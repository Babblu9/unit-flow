import { db } from './index.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';

/**
 * Upsert a user record from Clerk auth data.
 * Called on every authenticated request to ensure the user exists in our DB.
 */
export async function upsertUser({ clerkId, email, firstName, lastName, avatarUrl }) {
  if (!clerkId || !email) throw new Error('clerkId and email are required');

  const existing = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    const needsUpdate =
      user.email !== email ||
      user.firstName !== (firstName || null) ||
      user.lastName !== (lastName || null) ||
      user.avatarUrl !== (avatarUrl || null);

    if (needsUpdate) {
      const [updated] = await db.update(users)
        .set({
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          avatarUrl: avatarUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkId))
        .returning();
      return updated;
    }
    return user;
  }

  const [newUser] = await db.insert(users)
    .values({
      clerkId,
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      avatarUrl: avatarUrl || null,
    })
    .returning();

  return newUser;
}

export async function getUserByClerkId(clerkId) {
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result[0] || null;
}

export async function getUserById(id) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}
