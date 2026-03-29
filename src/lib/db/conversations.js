import { db } from './index.js';
import { conversations } from './schema.js';
import { eq, and, desc } from 'drizzle-orm';

export async function createConversation(userId, data = {}) {
  const [convo] = await db.insert(conversations)
    .values({
      userId,
      title: data.title || 'New Model',
      messages: data.messages || [],
      modelState: data.modelState || null,
      agentMeta: data.agentMeta || null,
      stage: data.stage || 'discovery',
      completion: data.completion || 0,
      validation: data.validation || null,
      screenPhase: data.screenPhase || 'welcome',
      modelGenerated: data.modelGenerated || false,
    })
    .returning();
  return convo;
}

export async function getConversations(userId) {
  return db.select({
    id: conversations.id,
    title: conversations.title,
    stage: conversations.stage,
    completion: conversations.completion,
    screenPhase: conversations.screenPhase,
    modelGenerated: conversations.modelGenerated,
    messageCount: conversations.messages,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
  })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.isActive, true)))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
}

export async function getConversation(id, userId) {
  const result = await db.select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result[0] || null;
}

export async function updateConversation(id, userId, data) {
  const updateData = { updatedAt: new Date() };
  if (data.title !== undefined)          updateData.title = data.title;
  if (data.messages !== undefined)       updateData.messages = data.messages;
  if (data.modelState !== undefined)     updateData.modelState = data.modelState;
  if (data.agentMeta !== undefined)      updateData.agentMeta = data.agentMeta;
  if (data.stage !== undefined)          updateData.stage = data.stage;
  if (data.completion !== undefined)     updateData.completion = data.completion;
  if (data.validation !== undefined)     updateData.validation = data.validation;
  if (data.screenPhase !== undefined)    updateData.screenPhase = data.screenPhase;
  if (data.modelGenerated !== undefined) updateData.modelGenerated = data.modelGenerated;

  const [updated] = await db.update(conversations)
    .set(updateData)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return updated || null;
}

export async function deleteConversation(id, userId) {
  const [deleted] = await db.update(conversations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return !!deleted;
}
