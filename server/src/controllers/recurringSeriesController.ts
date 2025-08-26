import { Context } from 'hono';
import { and, asc, eq, inArray, ilike, or, gte, lte, isNull } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as schema from '../schema';
import { isValidDateStr, isValidTimeStr, isValidWeekdayMask, isValidFrequency } from '../lib/validators';
import { computeOccurrences, upsertEventsForSeries } from '../services/events/recurrence';

export async function list(c: Context) {
  const db = await getDatabase();
  const q = c.req.query('q') || undefined;
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const conditions: any[] = [];
  if (q) conditions.push(or(ilike(schema.eventSeries.name, `%${q}%`), ilike(schema.eventSeries.description, `%${q}%`)));
  if (from && isValidDateStr(from)) conditions.push(or(isNull(schema.eventSeries.endDate), gte(schema.eventSeries.endDate, from)));
  if (to && isValidDateStr(to)) conditions.push(or(isNull(schema.eventSeries.startDate), lte(schema.eventSeries.startDate, to)));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(schema.eventSeries).where(whereClause as any).orderBy(asc(schema.eventSeries.name));
  return c.json(rows);
}

export async function create(c: Context) {
  const db = await getDatabase();
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) return c.json({ error: 'name required' }, 400);
  const startDate = body.startDate ? String(body.startDate).trim() : null;
  const endDate = body.endDate ? String(body.endDate).trim() : null;
  if (startDate && !isValidDateStr(startDate)) return c.json({ error: 'invalid startDate' }, 400);
  if (endDate && !isValidDateStr(endDate)) return c.json({ error: 'invalid endDate' }, 400);
  if (startDate && endDate && startDate > endDate) return c.json({ error: 'startDate must be <= endDate' }, 400);

  const defaultStatus = String(body.defaultStatus || 'planned').trim();
  const defaultStartTime = String(body.defaultStartTime || '00:00').trim();
  const defaultEndTime = String(body.defaultEndTime || '23:59').trim();
  if (!isValidTimeStr(defaultStartTime) || !isValidTimeStr(defaultEndTime)) return c.json({ error: 'invalid time format HH:mm' }, 400);

  const g: any = globalThis as any; let id: string | undefined = g?.crypto?.randomUUID?.();
  if (!id) { try { const nc = await import('node:crypto'); if (nc.randomUUID) id = nc.randomUUID(); } catch {} }
  if (!id) id = `ser_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const record = {
    id,
    name,
    description: (typeof body.description === 'string' && body.description.trim()) || null,
    startDate,
    endDate,
    defaultStatus,
    defaultStartTime,
    defaultEndTime,
    titleTemplate: (typeof body.titleTemplate === 'string' ? body.titleTemplate.trim() : null),
    promoterTemplate: (typeof body.promoterTemplate === 'string' ? body.promoterTemplate.trim() : null),
    templateJson: body.templateJson ?? null,
  } as const;

  const inserted = await db.insert(schema.eventSeries).values(record).returning();
  const created = inserted[0];

  const rule = body.rule || {};
  if (rule) {
    const frequency = String(rule.frequency || 'WEEKLY').trim().toUpperCase();
    const interval = Number(rule.interval ?? 1);
    const byWeekdayMask = Number(rule.byWeekdayMask ?? 0);
    if (!isValidFrequency(frequency)) return c.json({ error: 'invalid frequency' }, 400);
    if (!Number.isInteger(interval) || interval < 1) return c.json({ error: 'interval must be >= 1' }, 400);
    if (!isValidWeekdayMask(byWeekdayMask)) return c.json({ error: 'invalid byWeekdayMask' }, 400);

    const g2: any = globalThis as any; let rid: string | undefined = g2?.crypto?.randomUUID?.();
    if (!rid) { try { const nc = await import('node:crypto'); if (nc.randomUUID) rid = nc.randomUUID(); } catch {} }
    if (!rid) rid = `srl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(schema.eventSeriesRules).values({ id: rid, seriesId: created.id, frequency, interval, byWeekdayMask });
  }

  return c.json(created, 201);
}

export async function get(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const rows = await db.select().from(schema.eventSeries).where(eq(schema.eventSeries.id, seriesId)).limit(1);
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(rows[0]);
}

export async function patch(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('description' in body) patch.description = (typeof body.description === 'string' && body.description.trim()) || null;
  if ('startDate' in body) { if (body.startDate && !isValidDateStr(body.startDate)) return c.json({ error: 'invalid startDate' }, 400); patch.startDate = body.startDate || null; }
  if ('endDate' in body) { if (body.endDate && !isValidDateStr(body.endDate)) return c.json({ error: 'invalid endDate' }, 400); patch.endDate = body.endDate || null; }
  if ('defaultStatus' in body) patch.defaultStatus = String(body.defaultStatus || 'planned').trim();
  if ('defaultStartTime' in body) { if (!isValidTimeStr(body.defaultStartTime)) return c.json({ error: 'invalid defaultStartTime' }, 400); patch.defaultStartTime = body.defaultStartTime; }
  if ('defaultEndTime' in body) { if (!isValidTimeStr(body.defaultEndTime)) return c.json({ error: 'invalid defaultEndTime' }, 400); patch.defaultEndTime = body.defaultEndTime; }
  if ('titleTemplate' in body) patch.titleTemplate = (typeof body.titleTemplate === 'string' ? body.titleTemplate.trim() : null);
  if ('promoterTemplate' in body) patch.promoterTemplate = (typeof body.promoterTemplate === 'string' ? body.promoterTemplate.trim() : null);
  if ('templateJson' in body) patch.templateJson = body.templateJson ?? null;
  patch.updatedAt = new Date();
  if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) return c.json({ error: 'startDate must be <= endDate' }, 400);
  const updated = await db.update(schema.eventSeries).set(patch).where(eq(schema.eventSeries.id, seriesId)).returning();
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(updated[0]);
}

export async function remove(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  await db.delete(schema.eventSeries).where(eq(schema.eventSeries.id, seriesId));
  return c.body(null, 204);
}

export async function listAreas(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const rows = await db
    .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
    .from(schema.eventSeriesAreas)
    .innerJoin(schema.areas, eq(schema.eventSeriesAreas.areaId, schema.areas.id))
    .where(eq(schema.eventSeriesAreas.seriesId, seriesId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
  return c.json(rows);
}

export async function replaceAreas(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const incomingIds: string[] = Array.isArray(body.areaIds) ? Array.from(new Set(body.areaIds.map((s: any) => String(s || '').trim()).filter(Boolean))) : [];
  if (incomingIds.length > 0) {
    const existing = await db.select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, incomingIds));
    const existingIds = new Set(existing.map((r: any) => r.id));
    const missing = incomingIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) return c.json({ error: 'Unknown areaIds', details: missing }, 400);
  }
  const current = await db.select({ areaId: schema.eventSeriesAreas.areaId }).from(schema.eventSeriesAreas).where(eq(schema.eventSeriesAreas.seriesId, seriesId));
  const currentIds = new Set(current.map((r: any) => r.areaId));
  const toAdd = incomingIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !incomingIds.includes(id));
  if (toRemove.length > 0) await db.delete(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), (inArray as any)(schema.eventSeriesAreas.areaId, toRemove)));
  for (const aid of toAdd) await db.insert(schema.eventSeriesAreas).values({ seriesId, areaId: aid });
  const rows = await db
    .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
    .from(schema.eventSeriesAreas)
    .innerJoin(schema.areas, eq(schema.eventSeriesAreas.areaId, schema.areas.id))
    .where(eq(schema.eventSeriesAreas.seriesId, seriesId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
  return c.json(rows);
}

export async function addArea(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const areaId = String(body.areaId || '').trim();
  if (!areaId) return c.json({ error: 'areaId required' }, 400);
  const exists = await db.select({ id: schema.areas.id }).from(schema.areas).where(eq(schema.areas.id, areaId)).limit(1);
  if (exists.length === 0) return c.json({ error: 'Area not found' }, 404);
  const already = await db.select().from(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), eq(schema.eventSeriesAreas.areaId, areaId))).limit(1);
  if (already.length === 0) await db.insert(schema.eventSeriesAreas).values({ seriesId, areaId });
  const rows = await db
    .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
    .from(schema.eventSeriesAreas)
    .innerJoin(schema.areas, eq(schema.eventSeriesAreas.areaId, schema.areas.id))
    .where(eq(schema.eventSeriesAreas.seriesId, seriesId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
  return c.json(rows, 201);
}

export async function removeArea(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const areaId = c.req.param('areaId');
  await db.delete(schema.eventSeriesAreas).where(and(eq(schema.eventSeriesAreas.seriesId, seriesId), eq(schema.eventSeriesAreas.areaId, areaId)));
  return c.body(null, 204);
}

export async function preview(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const untilDate = String(body.untilDate || '').trim();
  let fromDate = body.fromDate ? String(body.fromDate).trim() : undefined;
  if (!isValidDateStr(untilDate)) return c.json({ error: 'invalid untilDate' }, 400);
  const sRows = await db.select().from(schema.eventSeries).where(eq(schema.eventSeries.id, seriesId)).limit(1);
  const series = sRows[0];
  if (!series) return c.json({ error: 'Series not found' }, 404);
  const rRows = await db.select().from(schema.eventSeriesRules).where(eq(schema.eventSeriesRules.seriesId, seriesId)).limit(1);
  const rule = rRows[0];
  if (!rule) return c.json({ error: 'Series rule not found' }, 404);
  // Default fromDate to series.startDate if not provided
  if (!fromDate && series.startDate) fromDate = series.startDate as any;
  const dates = computeOccurrences(series as any, rule as any, { fromDate, untilDate });
  return c.json({ dates, template: ((): any => { const t = (series as any); return { status: t.defaultStatus, startTime: t.defaultStartTime, endTime: t.defaultEndTime, title: t.titleTemplate, promoter: t.promoterTemplate }; })() });
}

export async function generate(c: Context) {
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const untilDate = String(body.untilDate || '').trim();
  let fromDate = body.fromDate ? String(body.fromDate).trim() : undefined;
  const overwriteExisting = Boolean(body.overwriteExisting);
  const setAreasMode = (body.setAreasMode === 'replace') ? 'replace' : 'skip';
  if (!isValidDateStr(untilDate)) return c.json({ error: 'invalid untilDate' }, 400);
  // Default fromDate by fetching series if necessary
  if (!fromDate) {
    const db = await getDatabase();
    const sRows = await db.select().from(schema.eventSeries).where(eq(schema.eventSeries.id, seriesId)).limit(1);
    const series = sRows[0];
    if (series?.startDate) fromDate = series.startDate as any;
  }
  const res = await upsertEventsForSeries(seriesId, { fromDate, untilDate, overwriteExisting, setAreasMode });
  return c.json(res, 201);
}


export async function getRule(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const rows = await db.select().from(schema.eventSeriesRules).where(eq(schema.eventSeriesRules.seriesId, seriesId)).limit(1);
  if (rows.length === 0) return c.json({ error: 'Series rule not found' }, 404);
  return c.json(rows[0]);
}

export async function patchRule(c: Context) {
  const db = await getDatabase();
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();

  const patch: any = {};
  if ('frequency' in body) {
    const frequency = String(body.frequency || '').trim().toUpperCase();
    if (!isValidFrequency(frequency)) return c.json({ error: 'invalid frequency' }, 400);
    patch.frequency = frequency;
  }
  if ('interval' in body) {
    const interval = Number(body.interval);
    if (!Number.isInteger(interval) || interval < 1) return c.json({ error: 'interval must be >= 1' }, 400);
    patch.interval = interval;
  }
  if ('byWeekdayMask' in body) {
    const byWeekdayMask = Number(body.byWeekdayMask);
    if (!isValidWeekdayMask(byWeekdayMask)) return c.json({ error: 'invalid byWeekdayMask' }, 400);
    patch.byWeekdayMask = byWeekdayMask;
  }

  const existing = await db.select().from(schema.eventSeriesRules).where(eq(schema.eventSeriesRules.seriesId, seriesId)).limit(1);
  if (existing.length === 0) {
    // Upsert: create a new rule if one does not exist yet
    const g: any = globalThis as any; let rid: string | undefined = g?.crypto?.randomUUID?.();
    if (!rid) { try { const nc = await import('node:crypto'); if (nc.randomUUID) rid = nc.randomUUID(); } catch {} }
    if (!rid) rid = `srl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const record = {
      id: rid,
      seriesId,
      frequency: (patch.frequency ?? String(body.frequency || 'WEEKLY').trim().toUpperCase()),
      interval: (patch.interval ?? Math.max(1, Number(body.interval ?? 1))),
      byWeekdayMask: (patch.byWeekdayMask ?? Math.max(0, Number(body.byWeekdayMask ?? 0))),
    };
    if (!isValidFrequency(record.frequency)) return c.json({ error: 'invalid frequency' }, 400);
    if (!Number.isInteger(record.interval) || record.interval < 1) return c.json({ error: 'interval must be >= 1' }, 400);
    if (!isValidWeekdayMask(record.byWeekdayMask)) return c.json({ error: 'invalid byWeekdayMask' }, 400);
    const rows = await db.insert(schema.eventSeriesRules).values(record).returning();
    return c.json(rows[0], 201);
  }

  const current = existing[0];
  const updated = await db.update(schema.eventSeriesRules).set({ ...patch, updatedAt: new Date() }).where(eq(schema.eventSeriesRules.id, current.id)).returning();
  return c.json(updated[0]);
}


