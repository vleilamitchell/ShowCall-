import { and, asc, eq, ilike, inArray } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type AreaRecord = typeof schema.areas.$inferSelect;
export type NewAreaRecord = typeof schema.areas.$inferInsert;

export async function listAreas(db: Database, params: { q?: string; active?: boolean | null }): Promise<AreaRecord[]> {
  const conditions: any[] = [];
  if (params.q) conditions.push(ilike(schema.areas.name, `%${params.q}%`));
  if (params.active != null) conditions.push(eq(schema.areas.active, params.active));

  const base = db.select().from(schema.areas);
  const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return query.orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
}

export async function insertArea(db: Database, record: NewAreaRecord): Promise<AreaRecord> {
  const inserted = await db.insert(schema.areas).values(record).returning();
  return inserted[0]!;
}

export async function updateAreaById(db: Database, areaId: string, patch: Partial<NewAreaRecord>): Promise<AreaRecord | null> {
  const updated = await db.update(schema.areas).set(patch as any).where(eq(schema.areas.id, areaId)).returning();
  return updated[0] ?? null;
}

export async function deleteAreaById(db: Database, areaId: string): Promise<void> {
  // Legacy behavior does not check affected row count; delete is idempotent 204 unless FK error
  await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
}

export async function reorderAreas(db: Database, ids: string[]): Promise<AreaRecord[]> {
  if (ids.length === 0) return listAreas(db, {});
  const existing = await db.select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, ids));
  const existsSet = new Set(existing.map((r: any) => r.id));
  const missing = ids.filter((id) => !existsSet.has(id));
  if (missing.length > 0) {
    const err: any = new Error('Unknown ids');
    err.code = 'UnknownIds';
    err.details = missing;
    throw err;
  }
  for (let i = 0; i < ids.length; i++) {
    await db.update(schema.areas).set({ sortOrder: i, updatedAt: new Date() }).where(eq(schema.areas.id, ids[i]!));
  }
  return listAreas(db, {});
}


