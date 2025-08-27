import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/schedulesRepo';
import * as schema from '../schema';
import { and, asc, eq, gte, ilike, lte } from 'drizzle-orm';
import { isValidDateStr } from '../lib/validators';

const conn = async () => getDatabase();

export async function list(params: { q?: string; isPublished?: boolean | null; from?: string; to?: string }) {
  const db = await conn();
  return repo.listSchedules(db, params);
}

export async function create(input: { name: string; startDate: string; endDate: string }) {
  const db = await conn();
  const name = String(input.name || '').trim();
  const startDate = String(input.startDate || '').trim();
  const endDate = String(input.endDate || '').trim();
  if (!name) throw new Error('name required');
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) throw new Error('invalid date format YYYY-MM-DD');
  if (startDate > endDate) throw new Error('startDate must be <= endDate');
  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `sch_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  return repo.insertSchedule(db, { id, name, startDate, endDate } as any);
}

export async function get(id: string) {
  const db = await conn();
  const row = await repo.getScheduleById(db, id);
  if (!row) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  return row;
}

export async function patch(id: string, body: Partial<{ name: string; startDate: string; endDate: string }>) {
  const db = await conn();
  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.startDate === 'string') { if (!isValidDateStr(body.startDate)) throw new Error('invalid startDate'); patch.startDate = body.startDate.trim(); }
  if (typeof body.endDate === 'string') { if (!isValidDateStr(body.endDate)) throw new Error('invalid endDate'); patch.endDate = body.endDate.trim(); }
  if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) throw new Error('startDate must be <= endDate');
  patch.updatedAt = new Date();
  const updated = await repo.updateScheduleById(db, id, patch);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  return updated;
}

export async function setPublished(id: string, published: boolean) {
  const db = await conn();
  const patch: any = { isPublished: published, publishedAt: published ? new Date() : null, updatedAt: new Date() };
  const updated = await repo.updateScheduleById(db, id, patch);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  return updated;
}

export async function generateShifts(scheduleId: string, departmentId: string, regenerate: boolean) {
  const db = await conn();
  if (!departmentId) throw new Error('departmentId required');
  const schedulesRows = await db.select().from(schema.schedules).where(eq(schema.schedules.id, scheduleId)).limit(1);
  const schedule = schedulesRows[0];
  if (!schedule) { const e: any = new Error('Schedule not found'); e.code = 'NotFound'; throw e; }
  if (!isValidDateStr(schedule.startDate) || !isValidDateStr(schedule.endDate)) throw new Error('Schedule has invalid dates');
  if (String(schedule.startDate) > String(schedule.endDate)) throw new Error('Schedule startDate must be <= endDate');

  if (regenerate) {
    if (schedule.isPublished) throw new Error('Cannot regenerate a published schedule. Unpublish first.');
    const existingShifts = await db.select({ id: schema.shifts.id }).from(schema.shifts).where(and(eq(schema.shifts.scheduleId, scheduleId), eq(schema.shifts.departmentId, departmentId)));
    const shiftIds = existingShifts.map((s: any) => s.id);
    if (shiftIds.length > 0) {
      await db.delete(schema.assignments).where((schema as any).inArray(schema.assignments.shiftId, shiftIds));
      await db.delete(schema.shifts).where((schema as any).inArray(schema.shifts.id, shiftIds));
    }
  }

  const eventsInRange = await db
    .select()
    .from(schema.events)
    .where(and(gte(schema.events.date, String(schedule.startDate)), lte(schema.events.date, String(schedule.endDate))))
    .orderBy(asc(schema.events.date), asc(schema.events.startTime));

  let created = 0;
  let skipped = 0;
  const createdShifts: any[] = [];
  for (const evt of eventsInRange as any[]) {
    if (!regenerate) {
      const exists = await db.select({ id: schema.shifts.id }).from(schema.shifts).where(and(eq(schema.shifts.scheduleId, scheduleId), eq(schema.shifts.departmentId, departmentId), eq(schema.shifts.eventId, evt.id))).limit(1);
      if (exists.length > 0) { skipped++; continue; }
    }
    let id: string | undefined;
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
    if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
    if (!id) id = `shf_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

    const ins = await db.insert(schema.shifts).values({ id, departmentId, scheduleId, date: evt.date, startTime: evt.startTime, endTime: evt.endTime, title: evt.title, notes: null, eventId: evt.id }).returning();
    createdShifts.push(ins[0]);
    created++;
  }
  return { created, skipped, shifts: createdShifts };
}

export async function remove(id: string) {
  const db = await conn();
  const ok = await repo.deleteScheduleById(db, id);
  if (!ok) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  return true;
}


