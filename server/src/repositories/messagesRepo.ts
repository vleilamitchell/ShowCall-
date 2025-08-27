import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type MessageRecord = typeof schema.messages.$inferSelect;
export type NewMessageRecord = typeof schema.messages.$inferInsert;

export async function insertMessage(db: Database, record: NewMessageRecord): Promise<MessageRecord> {
  const rows = await db.insert(schema.messages).values(record).returning();
  return rows[0]!;
}

export async function getMessageByDedupeKey(db: Database, dedupeKey: string): Promise<MessageRecord | null> {
  const rows = await db.select().from(schema.messages).where(eq(schema.messages.dedupeKey, dedupeKey)).orderBy(desc(schema.messages.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function updateMessageStatus(db: Database, id: string, patch: Partial<MessageRecord>): Promise<MessageRecord | null> {
  const rows = await db.update(schema.messages).set({ ...patch, updatedAt: new Date() } as any).where(eq(schema.messages.id, id)).returning();
  return rows[0] ?? null;
}

export async function findMessageByProviderId(db: Database, providerId: string): Promise<MessageRecord | null> {
  const rows = await db.select().from(schema.messages).where(eq(schema.messages.providerId, providerId)).limit(1);
  return rows[0] ?? null;
}


