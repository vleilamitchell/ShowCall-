import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type PushTokenRecord = typeof schema.pushTokens.$inferSelect;
export type NewPushTokenRecord = typeof schema.pushTokens.$inferInsert;

export async function upsertPushToken(db: Database, record: NewPushTokenRecord): Promise<PushTokenRecord> {
  const rows = await (db as any)
    .insert(schema.pushTokens)
    .values(record)
    .onConflictDoUpdate({
      target: schema.pushTokens.token,
      set: {
        userId: record.userId,
        provider: record.provider,
        platform: record.platform,
        lastSeenAt: record.lastSeenAt ?? new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0]!;
}

export async function listTokensForUser(db: Database, userId: string): Promise<PushTokenRecord[]> {
  return db.select().from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId)).orderBy(desc(schema.pushTokens.updatedAt));
}


