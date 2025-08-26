import { and, asc, eq, inArray } from 'drizzle-orm';
import * as schema from '../schema';
import { withTransaction } from '../lib/db';

export type Database = any;

export async function listAreasForEvent(db: Database, eventId: string) {
  return db
    .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
    .from(schema.eventAreas)
    .innerJoin(schema.areas, eq(schema.eventAreas.areaId, schema.areas.id))
    .where(eq(schema.eventAreas.eventId, eventId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
}

export async function listAreasForEventIds(db: Database, eventIds: string[]) {
  if (eventIds.length === 0) return [] as Array<{ eventId: string; id: string; name: string; description: string | null; color: string | null; active: boolean; updatedAt: Date | null }>;
  return db
    .select({
      eventId: schema.eventAreas.eventId,
      id: schema.areas.id,
      name: schema.areas.name,
      description: schema.areas.description,
      color: schema.areas.color,
      active: schema.areas.active,
      updatedAt: schema.areas.updatedAt,
    })
    .from(schema.eventAreas)
    .innerJoin(schema.areas, eq(schema.eventAreas.areaId, schema.areas.id))
    .where((inArray as any)(schema.eventAreas.eventId, eventIds))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
}

export async function replaceAreasForEvent(db: Database, eventId: string, incomingIds: string[]) {
  return withTransaction(async (tx) => {
    if (incomingIds.length > 0) {
      const existing = await (tx as any).select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, incomingIds));
      const existingIds = new Set(existing.map((r: any) => r.id));
      const missing = incomingIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        const err: any = new Error('Unknown areaIds');
        err.code = 'UnknownAreaIds';
        err.details = missing;
        throw err;
      }
    }
    const current = await (tx as any).select({ areaId: schema.eventAreas.areaId }).from(schema.eventAreas).where(eq(schema.eventAreas.eventId, eventId));
    const currentIds = new Set(current.map((r: any) => r.areaId));
    const toAdd = incomingIds.filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter((id) => !incomingIds.includes(id));
    if (toRemove.length > 0) await (tx as any).delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), (inArray as any)(schema.eventAreas.areaId, toRemove)));
    for (const aid of toAdd) await (tx as any).insert(schema.eventAreas).values({ eventId, areaId: aid });
    return listAreasForEvent(tx as any, eventId);
  });
}

export async function addAreaToEvent(db: Database, eventId: string, areaId: string) {
  const exists = await db.select({ id: schema.areas.id }).from(schema.areas).where(eq(schema.areas.id, areaId)).limit(1);
  if (exists.length === 0) {
    const err: any = new Error('Area not found');
    err.code = 'AreaNotFound';
    throw err;
  }
  const already = await db.select().from(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), eq(schema.eventAreas.areaId, areaId))).limit(1);
  if (already.length === 0) await db.insert(schema.eventAreas).values({ eventId, areaId });
  return listAreasForEvent(db, eventId);
}

export async function removeAreaFromEvent(db: Database, eventId: string, areaId: string) {
  await db.delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), eq(schema.eventAreas.areaId, areaId)));
  return true;
}


