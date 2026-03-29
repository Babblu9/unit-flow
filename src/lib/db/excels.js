import { db } from './index.js';
import { generatedExcels } from './schema.js';
import { eq, and, desc } from 'drizzle-orm';

export async function saveExcel({ userId, conversationId, fileName, fileData, modelSnapshot }) {
  let version = 1;
  if (conversationId) {
    const existing = await db.select({ id: generatedExcels.id })
      .from(generatedExcels)
      .where(and(
        eq(generatedExcels.userId, userId),
        eq(generatedExcels.conversationId, conversationId),
      ));
    version = existing.length + 1;
  }

  const [excel] = await db.insert(generatedExcels)
    .values({
      userId,
      conversationId: conversationId || null,
      fileName,
      fileData,
      fileSize: Buffer.isBuffer(fileData) ? fileData.length : fileData.byteLength,
      modelSnapshot: modelSnapshot || null,
      version,
    })
    .returning({
      id: generatedExcels.id,
      fileName: generatedExcels.fileName,
      fileSize: generatedExcels.fileSize,
      version: generatedExcels.version,
      createdAt: generatedExcels.createdAt,
    });

  return excel;
}

export async function getExcels(userId) {
  return db.select({
    id: generatedExcels.id,
    conversationId: generatedExcels.conversationId,
    fileName: generatedExcels.fileName,
    fileSize: generatedExcels.fileSize,
    version: generatedExcels.version,
    createdAt: generatedExcels.createdAt,
  })
    .from(generatedExcels)
    .where(eq(generatedExcels.userId, userId))
    .orderBy(desc(generatedExcels.createdAt))
    .limit(100);
}

export async function getExcel(id, userId) {
  const result = await db.select()
    .from(generatedExcels)
    .where(and(eq(generatedExcels.id, id), eq(generatedExcels.userId, userId)))
    .limit(1);
  return result[0] || null;
}

export async function deleteExcel(id, userId) {
  const result = await db.delete(generatedExcels)
    .where(and(eq(generatedExcels.id, id), eq(generatedExcels.userId, userId)))
    .returning({ id: generatedExcels.id });
  return result.length > 0;
}
