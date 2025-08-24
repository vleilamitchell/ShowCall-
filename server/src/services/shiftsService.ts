import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as schema from '../schema';
import { isValidDateStr, isValidTimeStr } from '../lib/validators';

const conn = async () => getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');

export async function listByDepartment(departmentId: string, params: { q?: string; scheduleId?: string; from?: string; to?: string; published?: string | null }) {
  const db = await conn();
  const conditions: any[] = [eq(schema.shifts.departmentId, departmentId)];
  if (params.q) conditions.push(or(ilike(schema.shifts.title, `%${params.q}%`), ilike(schema.shifts.notes, `%${params.q}%`)));
  if (params.scheduleId) conditions.push(eq(schema.shifts.scheduleId, params.scheduleId));
  if (params.from && isValidDateStr(params.from)) conditions.push(gte(schema.shifts.date, params.from));
  if (params.to && isValidDateStr(params.to)) conditions.push(lte(schema.shifts.date, params.to));

  const rows = await db
    .select({
      id: schema.shifts.id,
      departmentId: schema.shifts.departmentId,
      scheduleId: schema.shifts.scheduleId,
      date: schema.shifts.date,
      startTime: schema.shifts.startTime,
      endTime: schema.shifts.endTime,
      title: schema.shifts.title,
      notes: schema.shifts.notes,
      eventId: schema.shifts.eventId,
      updatedAt: schema.shifts.updatedAt,
      schedulePublished: schema.schedules.isPublished,
    })
    .from(schema.shifts)
    .leftJoin(schema.schedules, eq(schema.shifts.scheduleId, schema.schedules.id))
    .where(and(...conditions))
    .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));

  const mapped = rows.map((r: any) => ({ ...r, derivedPublished: Boolean(r.scheduleId && r.schedulePublished) }));
  if (params.published != null) {
    const want = params.published === 'true';
    return mapped.filter((m: any) => m.derivedPublished === want);
  }
  return mapped;
}

export async function create(departmentId: string, body: any) {
  const db = await conn();
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';
  const endTime = typeof body.endTime === 'string' ? body.endTime.trim() : '';
  if (!isValidDateStr(date)) throw new Error('invalid date');
  if (!isValidTimeStr(startTime) || !isValidTimeStr(endTime)) throw new Error('invalid time HH:mm');
  if (!(startTime < endTime)) throw new Error('startTime must be < endTime');

  const title = typeof body.title === 'string' ? (body.title.trim() || null) : null;
  const notes = typeof body.notes === 'string' ? (body.notes.trim() || null) : null;
  const scheduleId = typeof body.scheduleId === 'string' && body.scheduleId.trim() ? body.scheduleId.trim() : null;
  const eventId = typeof body.eventId === 'string' && body.eventId.trim() ? body.eventId.trim() : null;

  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `shf_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  const inserted = await db.insert(schema.shifts).values({
    id,
    departmentId,
    scheduleId: scheduleId as any,
    date,
    startTime,
    endTime,
    title,
    notes,
    eventId: eventId as any,
  }).returning();
  const created = inserted[0]!;

  const overlaps = await db
    .select({ id: schema.shifts.id, start: schema.shifts.startTime, end: schema.shifts.endTime, title: schema.shifts.title })
    .from(schema.shifts)
    .where(and(
      eq(schema.shifts.departmentId, departmentId),
      eq(schema.shifts.date, date),
      sql`(${schema.shifts.startTime.name} < ${endTime}) and (${schema.shifts.endTime.name} > ${startTime}) and (${schema.shifts.id.name} <> ${created.id})`
    ));

  let derivedPublished = false;
  if (created.scheduleId) {
    const sched = await db.select({ isPublished: schema.schedules.isPublished }).from(schema.schedules).where(eq(schema.schedules.id, created.scheduleId)).limit(1);
    derivedPublished = Boolean(created.scheduleId && sched[0]?.isPublished);
  }
  const warnings = overlaps.length > 0 ? overlaps.map((o: any) => `Overlaps with shift ${o.title || o.id}`) : [];
  return { ...created, derivedPublished, warnings };
}

export async function get(id: string) {
  const db = await conn();
  const rows = await db.select().from(schema.shifts).where(eq(schema.shifts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function patch(id: string, body: any) {
  const db = await conn();
  const patch: any = {};
  if (typeof body.title === 'string') patch.title = body.title.trim() || null;
  if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null;
  if (typeof body.date === 'string') { if (!isValidDateStr(body.date)) throw new Error('invalid date'); patch.date = body.date.trim(); }
  if (typeof body.startTime === 'string') { if (!isValidTimeStr(body.startTime)) throw new Error('invalid time'); patch.startTime = body.startTime.trim(); }
  if (typeof body.endTime === 'string') { if (!isValidTimeStr(body.endTime)) throw new Error('invalid time'); patch.endTime = body.endTime.trim(); }
  if (("startTime" in patch) && ("endTime" in patch) && !(patch.startTime < patch.endTime)) throw new Error('startTime must be < endTime');
  if ('scheduleId' in body) patch.scheduleId = (typeof body.scheduleId === 'string' && body.scheduleId.trim()) ? String(body.scheduleId).trim() : null;
  if ('eventId' in body) patch.eventId = (typeof body.eventId === 'string' && body.eventId.trim()) ? String(body.eventId).trim() : null;
  patch.updatedAt = new Date();
  const updated = await db.update(schema.shifts).set(patch).where(eq(schema.shifts.id, id)).returning();
  return updated[0] ?? null;
}

export async function remove(id: string) {
  const db = await conn();
  await db.delete(schema.shifts).where(eq(schema.shifts.id, id));
}


