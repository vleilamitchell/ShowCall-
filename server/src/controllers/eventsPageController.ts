import { Context } from 'hono';
import { getDatabase } from '../lib/db';
import * as eventsRepo from '../repositories/eventsRepo';
import * as areasRepo from '../repositories/areasRepo';
import * as eventAreasRepo from '../repositories/eventAreasRepo';
import * as departmentsRepo from '../repositories/departmentsRepo';
import * as schedulesRepo from '../repositories/schedulesRepo';
import * as schema from '../schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

export async function events(c: Context) {
  const db = await getDatabase();
  const q = c.req.query('q') || undefined;
  const status = c.req.query('status') || undefined;
  const includePast = (c.req.query('includePast') || 'false') === 'true';
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const selectedId = c.req.query('selectedId') || undefined;

  const events = await eventsRepo.listEvents(db, { q, status, includePast, from, to } as any);
  const eventIds = events.map((e: any) => e.id);

  const [areasActive, areasRows, departments] = await Promise.all([
    areasRepo.listAreas(db as any, { q: undefined, active: true }),
    eventAreasRepo.listAreasForEventIds(db as any, eventIds),
    departmentsRepo.listDepartments(db as any, {} as any),
  ]);

  const areasByEvent: Record<string, any[]> = {};
  for (const r of areasRows as any[]) {
    const eid = r.eventId as string;
    if (!areasByEvent[eid]) areasByEvent[eid] = [];
    areasByEvent[eid].push({ id: r.id, name: r.name, description: r.description, color: r.color, active: r.active, updatedAt: r.updatedAt });
  }

  let selected: any = undefined;
  if (selectedId) {
    const event = await eventsRepo.getEventById(db as any, selectedId);
    if (event) {
      const shifts = await eventsRepo.listShiftsByEventId(db as any, selectedId);
      selected = { event, shifts };
    }
  }

  return c.json({
    events,
    areasActive,
    areasByEvent,
    departments,
    selected,
  });
}

export async function eventDetail(c: Context) {
  const db = await getDatabase();
  const eventId = c.req.query('eventId') || '';
  if (!eventId) return c.json({ error: 'eventId required' }, 400);
  const event = await eventsRepo.getEventById(db as any, eventId);
  if (!event) return c.json({ error: 'Not found' }, 404);
  const [areas, shifts] = await Promise.all([
    eventAreasRepo.listAreasForEvent(db as any, eventId),
    eventsRepo.listShiftsByEventId(db as any, eventId),
  ]);
  return c.json({ event, areas, shifts });
}

// GET /bootstrap/schedule-detail?scheduleId=...&departmentId=...
// Returns shifts for schedule (optionally filtered by department), assignments, employee names, positions, and event areas.
export async function scheduleDetail(c: Context) {
  const db = await getDatabase();
  const scheduleId = c.req.query('scheduleId') || '';
  const departmentId = c.req.query('departmentId') || undefined;
  if (!scheduleId) return c.json({ error: 'scheduleId required' }, 400);
  const schedule = await schedulesRepo.getScheduleById(db as any, scheduleId);
  if (!schedule) return c.json({ error: 'Not found' }, 404);

  // Shifts for schedule (optionally department filtered)
  const shiftWhere = departmentId
    ? and(eq(schema.shifts.scheduleId, scheduleId), eq(schema.shifts.departmentId, departmentId))
    : eq(schema.shifts.scheduleId, scheduleId);
  const shifts = await (db as any)
    .select()
    .from((schema as any).shifts)
    .where(shiftWhere as any)
    .orderBy(asc((schema as any).shifts.date), asc((schema as any).shifts.startTime));

  const shiftIds: string[] = (shifts as any[]).map((s: any) => s.id);
  const eventIds: string[] = Array.from(new Set((shifts as any[]).map((s: any) => s.eventId).filter(Boolean)));
  const deptIds: string[] = Array.from(new Set((shifts as any[]).map((s: any) => s.departmentId).filter(Boolean)));

  // Assignments for listed shifts
  const assignments = shiftIds.length > 0
    ? await (db as any)
        .select()
        .from((schema as any).assignments)
        .where((inArray as any)((schema as any).assignments.shiftId, shiftIds))
    : [];

  // Employees (names) by department
  const employeesByDept: Record<string, Array<{ id: string; name: string }>> = {};
  for (const did of deptIds) {
    const rows = await (db as any)
      .select({ id: (schema as any).employees.id, name: (schema as any).employees.name })
      .from((schema as any).employees)
      .where(eq((schema as any).employees.departmentId, did));
    employeesByDept[did] = (rows as any[]).map((r: any) => ({ id: r.id, name: r.name || r.id }));
  }

  // Positions by department
  const positionsByDept: Record<string, Array<{ id: string; name: string }>> = {};
  for (const did of deptIds) {
    const rows = await (db as any)
      .select({ id: (schema as any).positions.id, name: (schema as any).positions.name })
      .from((schema as any).positions)
      .where(eq((schema as any).positions.departmentId, did))
      .orderBy(asc((schema as any).positions.name));
    positionsByDept[did] = rows as any[];
  }

  // Event areas for events present
  const areasByEvent: Record<string, any[]> = {};
  if (eventIds.length > 0) {
    const rows = await eventAreasRepo.listAreasForEventIds(db as any, eventIds);
    for (const r of rows as any[]) {
      if (!areasByEvent[r.eventId]) areasByEvent[r.eventId] = [];
      areasByEvent[r.eventId].push({ id: r.id, name: r.name, description: r.description, color: r.color, active: r.active, updatedAt: r.updatedAt });
    }
  }

  // Minimal event title map to avoid extra client fetches
  const eventsById: Record<string, { id: string; title: string }> = {};
  for (const eid of eventIds) {
    const ev = await eventsRepo.getEventById(db as any, eid);
    if (ev) eventsById[eid] = { id: ev.id, title: (ev as any).title || eid };
  }

  return c.json({ schedule, shifts, assignments, employeesByDept, positionsByDept, areasByEvent, eventsById });
}



