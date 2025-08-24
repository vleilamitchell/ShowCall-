import { and, asc, eq, ilike } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type PositionRecord = typeof schema.positions.$inferSelect;
export type NewPositionRecord = typeof schema.positions.$inferInsert;

export async function listPositions(db: Database, departmentId: string, params: { q?: string }): Promise<PositionRecord[]> {
  const conditions: any[] = [eq(schema.positions.departmentId, departmentId)];
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(ilike(schema.positions.name, pattern));
  }
  return db
    .select()
    .from(schema.positions)
    .where(and(...conditions))
    .orderBy(asc(schema.positions.name));
}

export async function insertPosition(db: Database, record: NewPositionRecord): Promise<PositionRecord> {
  const inserted = await db.insert(schema.positions).values(record).returning();
  return inserted[0]!;
}

export async function updatePositionById(db: Database, id: string, patch: Partial<NewPositionRecord>): Promise<PositionRecord | null> {
  const updated = await db.update(schema.positions).set(patch as any).where(eq(schema.positions.id, id)).returning();
  return updated[0] ?? null;
}

export async function deletePositionById(db: Database, id: string): Promise<void> {
  await db.delete(schema.positions).where(eq(schema.positions.id, id));
}


