import { Context } from 'hono';
import { getDatabase } from '../lib/db';
import * as eventsRepo from '../repositories/eventsRepo';
import * as areasRepo from '../repositories/areasRepo';
import * as eventAreasRepo from '../repositories/eventAreasRepo';
import * as departmentsRepo from '../repositories/departmentsRepo';

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


