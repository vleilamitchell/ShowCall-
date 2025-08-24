import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import * as schema from '../schema';

export type Database = any; // Drizzle database instance obtained via getDatabase

export type ListEventsParams = {
  status?: string;
  q?: string;
  includePast?: boolean;
  areaIds?: string[];
  from?: string;
  to?: string;
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function listEvents(db: Database, params: ListEventsParams) {
  const { status, q, includePast, areaIds, from, to } = params;

  const now = new Date();
  const today = formatDate(now);
  const currentTime = formatTime(now);

  const conditions: any[] = [];
  if (!includePast) {
    conditions.push(
      or(
        and(eq(schema.events.date, today), gte(schema.events.endTime, currentTime)),
        gt(schema.events.date, today)
      )
    );
  }
  if (status) conditions.push(eq(schema.events.status, status));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(schema.events.title, pattern),
        ilike(schema.events.promoter, pattern),
        ilike(schema.events.artists, pattern)
      )
    );
  }
  if (from) conditions.push(gte(schema.events.date, from));
  if (to) conditions.push(lte(schema.events.date, to));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  if (Array.isArray(areaIds) && areaIds.length > 0) {
    if (areaIds.length === 1) {
      const idRows = await db
        .select({ id: schema.events.id })
        .from(schema.events)
        .innerJoin(schema.eventAreas, eq(schema.eventAreas.eventId, schema.events.id))
        .where(and((whereClause as any) || and(), eq(schema.eventAreas.areaId, areaIds[0]!)) as any);
      const ids = idRows.map((r: any) => r.id);
      return db
        .select()
        .from(schema.events)
        .where(ids.length > 0 ? (inArray as any)(schema.events.id, ids) : (sql`false`))
        .orderBy(desc(schema.events.date), desc(schema.events.startTime));
    } else {
      const idRows = await db
        .select({ id: schema.events.id })
        .from(schema.events)
        .innerJoin(schema.eventAreas, eq(schema.eventAreas.eventId, schema.events.id))
        .where(and((whereClause as any) || and(), (inArray as any)(schema.eventAreas.areaId, areaIds)) as any);
      const idsSet = new Set(idRows.map((r: any) => r.id));
      const ids = Array.from(idsSet);
      return db
        .select()
        .from(schema.events)
        .where(ids.length > 0 ? (inArray as any)(schema.events.id, ids) : (sql`false`))
        .orderBy(desc(schema.events.date), desc(schema.events.startTime));
    }
  }

  return db
    .select()
    .from(schema.events)
    .where(whereClause as any)
    .orderBy(desc(schema.events.date), desc(schema.events.startTime));
}

export type NewEventRecord = typeof schema.events.$inferInsert;
export type EventRecord = typeof schema.events.$inferSelect;

export async function insertEvent(db: Database, record: NewEventRecord): Promise<EventRecord> {
  const rows = await db.insert(schema.events).values(record).returning();
  return rows[0];
}

export async function getEventById(db: Database, eventId: string): Promise<EventRecord | undefined> {
  const rows = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
  return rows[0];
}

export async function updateEventById(db: Database, eventId: string, patch: Partial<NewEventRecord>): Promise<EventRecord | undefined> {
  const rows = await db.update(schema.events).set(patch).where(eq(schema.events.id, eventId)).returning();
  return rows[0];
}

export async function deleteEventById(db: Database, eventId: string): Promise<boolean> {
  // Delete dependent shifts first
  await db.delete(schema.shifts).where(eq(schema.shifts.eventId, eventId));
  const rows = await db.delete(schema.events).where(eq(schema.events.id, eventId)).returning();
  return rows.length > 0;
}

export async function listShiftsByEventId(db: Database, eventId: string) {
  return db
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.eventId, eventId))
    .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));
}


