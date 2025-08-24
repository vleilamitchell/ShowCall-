import { and, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type ScheduleRecord = typeof schema.schedules.$inferSelect;
export type NewScheduleRecord = typeof schema.schedules.$inferInsert;

export async function listSchedules(db: Database, params: { q?: string; isPublished?: boolean | null; from?: string; to?: string }) {
  const conditions: any[] = [];
  if (params.q) conditions.push(ilike(schema.schedules.name, `%${params.q}%`));
  if (params.isPublished != null) conditions.push(eq(schema.schedules.isPublished, params.isPublished));
  if (params.from) conditions.push(gte(schema.schedules.endDate, params.from));
  if (params.to) conditions.push(lte(schema.schedules.startDate, params.to));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(schema.schedules).where(whereClause as any).orderBy(desc(schema.schedules.createdAt));
}

export async function insertSchedule(db: Database, record: NewScheduleRecord) {
  const inserted = await db.insert(schema.schedules).values(record).returning();
  return inserted[0]!;
}

export async function getScheduleById(db: Database, id: string) {
  const rows = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateScheduleById(db: Database, id: string, patch: Partial<NewScheduleRecord>) {
  const updated = await db.update(schema.schedules).set(patch as any).where(eq(schema.schedules.id, id)).returning();
  return updated[0] ?? null;
}


