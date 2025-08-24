import { and, asc, eq, ilike, isNull, gte, lte } from 'drizzle-orm';
import * as schema from '../schema';

export type Database = any;

export async function listSeries(db: Database, params: { q?: string; from?: string; to?: string }) {
  const { q, from, to } = params;
  const conditions: any[] = [];
  if (q) conditions.push(and(or(ilike(schema.eventSeries.name, `%${q}%`), ilike(schema.eventSeries.description, `%${q}%`))));
  if (from) conditions.push(or(isNull(schema.eventSeries.endDate), gte(schema.eventSeries.endDate, from)));
  if (to) conditions.push(or(isNull(schema.eventSeries.startDate), lte(schema.eventSeries.startDate, to)));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(schema.eventSeries).where(whereClause as any).orderBy(asc(schema.eventSeries.name));
}

export type NewSeriesRecord = typeof schema.eventSeries.$inferInsert;
export type SeriesRecord = typeof schema.eventSeries.$inferSelect;

export async function insertSeries(db: Database, record: NewSeriesRecord): Promise<SeriesRecord> {
  const rows = await db.insert(schema.eventSeries).values(record).returning();
  return rows[0];
}

export async function getSeriesById(db: Database, id: string): Promise<SeriesRecord | undefined> {
  const rows = await db.select().from(schema.eventSeries).where(eq(schema.eventSeries.id, id)).limit(1);
  return rows[0];
}

export async function updateSeriesById(db: Database, id: string, patch: Partial<NewSeriesRecord>): Promise<SeriesRecord | undefined> {
  const rows = await db.update(schema.eventSeries).set(patch).where(eq(schema.eventSeries.id, id)).returning();
  return rows[0];
}

export async function deleteSeriesById(db: Database, id: string): Promise<boolean> {
  const rows = await db.delete(schema.eventSeries).where(eq(schema.eventSeries.id, id)).returning();
  return rows.length > 0;
}

export type NewSeriesRuleRecord = typeof schema.eventSeriesRules.$inferInsert;
export type SeriesRuleRecord = typeof schema.eventSeriesRules.$inferSelect;

export async function getRuleBySeriesId(db: Database, seriesId: string): Promise<SeriesRuleRecord | undefined> {
  const rows = await db.select().from(schema.eventSeriesRules).where(eq(schema.eventSeriesRules.seriesId, seriesId)).limit(1);
  return rows[0];
}

export async function insertRule(db: Database, record: NewSeriesRuleRecord): Promise<SeriesRuleRecord> {
  const rows = await db.insert(schema.eventSeriesRules).values(record).returning();
  return rows[0];
}

export async function updateRuleById(db: Database, id: string, patch: Partial<NewSeriesRuleRecord>): Promise<SeriesRuleRecord | undefined> {
  const rows = await db.update(schema.eventSeriesRules).set(patch).where(eq(schema.eventSeriesRules.id, id)).returning();
  return rows[0];
}

export async function listAreasForSeries(db: Database, seriesId: string) {
  return db
    .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
    .from(schema.eventSeriesAreas)
    .innerJoin(schema.areas, eq(schema.eventSeriesAreas.areaId, schema.areas.id))
    .where(eq(schema.eventSeriesAreas.seriesId, seriesId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
}

export async function replaceAreasForSeries(db: Database, seriesId: string, incomingIds: string[]) {
  if (incomingIds.length > 0) {
    const existing = await db.select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, incomingIds));
    const existingIds = new Set(existing.map((r: any) => r.id));
    const missing = incomingIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      const err: any = new Error('Unknown areaIds');
      err.code = 'UnknownAreaIds';
      err.details = missing;
      throw err;
    }
  }
  const current = await db.select({ areaId: schema.eventSeriesAreas.areaId }).from(schema.eventSeriesAreas).where(eq(schema.eventSeriesAreas.seriesId, seriesId));
  const currentIds = new Set(current.map((r: any) => r.areaId));
  const toAdd = incomingIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !incomingIds.includes(id));
  if (toRemove.length > 0) await db.delete(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), (inArray as any)(schema.eventSeriesAreas.areaId, toRemove)));
  for (const aid of toAdd) await db.insert(schema.eventSeriesAreas).values({ seriesId, areaId: aid });
  return listAreasForSeries(db, seriesId);
}

export async function addAreaToSeries(db: Database, seriesId: string, areaId: string) {
  const exists = await db.select({ id: schema.areas.id }).from(schema.areas).where(eq(schema.areas.id, areaId)).limit(1);
  if (exists.length === 0) {
    const err: any = new Error('Area not found');
    err.code = 'AreaNotFound';
    throw err;
  }
  const already = await db.select().from(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), eq(schema.eventSeriesAreas.areaId, areaId))).limit(1);
  if (already.length === 0) await db.insert(schema.eventSeriesAreas).values({ seriesId, areaId });
  return listAreasForSeries(db, seriesId);
}

export async function removeAreaFromSeries(db: Database, seriesId: string, areaId: string) {
  await db.delete(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), eq(schema.eventSeriesAreas.areaId, areaId)));
  return true;
}


