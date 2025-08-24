import { and, asc, eq } from 'drizzle-orm';
import { DatabaseConnection, getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function insert(rec: typeof schema.reservations.$inferInsert, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres'));
  const inserted = await db.insert(schema.reservations).values(rec).returning();
  return inserted[0];
}

export async function list(params: { itemId?: string; eventId?: string }, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres'));
  const conditions: any[] = [];
  if (params.itemId) conditions.push(eq(schema.reservations.itemId, params.itemId));
  if (params.eventId) conditions.push(eq(schema.reservations.eventId, params.eventId));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return db.select().from(schema.reservations).where(whereClause as any).orderBy(asc(schema.reservations.startTs));
}

export async function updateStatus(resId: string, status: string, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres'));
  const updated = await db.update(schema.reservations).set({ status, updatedAt: new Date() }).where(eq(schema.reservations.resId, resId)).returning();
  return updated[0] || null;
}


