import { Context } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/recurringSeriesRepo';
import { isValidDateStr, isValidTimeStr, isValidWeekdayMask, isValidFrequency } from '../lib/validators';
import { computeOccurrences, upsertEventsForSeries } from '../services/events/recurrence';

export async function list(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const q = c.req.query('q') || undefined;
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const rows = await repo.listSeries(db, { q, from, to });
  return c.json(rows);
}

export async function create(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
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

  let id: string | undefined; const g: any = globalThis as any; if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
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
    artistsTemplate: (typeof body.artistsTemplate === 'string' ? body.artistsTemplate.trim() : null),
    templateJson: body.templateJson ?? null,
    updatedAt: new Date() as any,
  } as repo.NewSeriesRecord;

  const created = await repo.insertSeries(db, record);

  const rule = body.rule || {};
  if (rule) {
    const frequency = String(rule.frequency || 'WEEKLY').trim().toUpperCase();
    const interval = Number(rule.interval ?? 1);
    const byWeekdayMask = Number(rule.byWeekdayMask ?? 0);
    if (!isValidFrequency(frequency)) return c.json({ error: 'invalid frequency' }, 400);
    if (!Number.isInteger(interval) || interval < 1) return c.json({ error: 'interval must be >= 1' }, 400);
    if (!isValidWeekdayMask(byWeekdayMask)) return c.json({ error: 'invalid byWeekdayMask' }, 400);
    let rid: string | undefined; const g2: any = globalThis as any; if (g2?.crypto?.randomUUID) rid = g2.crypto.randomUUID();
    if (!rid) { try { const nc = await import('node:crypto'); if (nc.randomUUID) rid = nc.randomUUID(); } catch {} }
    if (!rid) rid = `srl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await repo.insertRule(db, { id: rid, seriesId: created.id, frequency, interval, byWeekdayMask } as any);
  }

  return c.json(created, 201);
}

export async function get(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  const row = await repo.getSeriesById(db, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function patch(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
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
  if ('artistsTemplate' in body) patch.artistsTemplate = (typeof body.artistsTemplate === 'string' ? body.artistsTemplate.trim() : null);
  if ('templateJson' in body) patch.templateJson = body.templateJson ?? null;
  patch.updatedAt = new Date();
  if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) return c.json({ error: 'startDate must be <= endDate' }, 400);
  const updated = await repo.updateSeriesById(db, id, patch);
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
}

export async function remove(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  await repo.deleteSeriesById(db, id);
  return c.body(null, 204);
}

export async function listAreas(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  const rows = await repo.listAreasForSeries(db, id);
  return c.json(rows);
}

export async function replaceAreas(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  const body = await c.req.json();
  const incomingIds: string[] = Array.isArray(body.areaIds) ? Array.from(new Set(body.areaIds.map((s: any) => String(s || '').trim()).filter(Boolean))) : [];
  try {
    const rows = await repo.replaceAreasForSeries(db, id, incomingIds);
    return c.json(rows);
  } catch (e: any) {
    if (String(e?.code) === 'UnknownAreaIds') return c.json({ error: 'Unknown areaIds', details: e.details }, 400);
    throw e;
  }
}

export async function addArea(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  const body = await c.req.json();
  const areaId = String(body.areaId || '').trim();
  if (!areaId) return c.json({ error: 'areaId required' }, 400);
  try {
    const rows = await repo.addAreaToSeries(db, id, areaId);
    return c.json(rows, 201);
  } catch (e: any) {
    if (String(e?.code) === 'AreaNotFound') return c.json({ error: 'Area not found' }, 404);
    throw e;
  }
}

export async function removeArea(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('seriesId');
  const areaId = c.req.param('areaId');
  await repo.removeAreaFromSeries(db, id, areaId);
  return c.body(null, 204);
}

export async function preview(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const untilDate = String(body.untilDate || '').trim();
  const fromDate = body.fromDate ? String(body.fromDate).trim() : undefined;
  if (!isValidDateStr(untilDate)) return c.json({ error: 'invalid untilDate' }, 400);
  const series = await repo.getSeriesById(db, seriesId);
  if (!series) return c.json({ error: 'Series not found' }, 404);
  const rule = await repo.getRuleBySeriesId(db, seriesId);
  if (!rule) return c.json({ error: 'Series rule not found' }, 404);
  const dates = computeOccurrences(series as any, rule as any, { fromDate, untilDate });
  return c.json({ dates, template: ((): any => { const t = (series as any); return { status: t.defaultStatus, startTime: t.defaultStartTime, endTime: t.defaultEndTime, title: t.titleTemplate, promoter: t.promoterTemplate, artists: t.artistsTemplate }; })() });
}

export async function generate(c: Context) {
  const seriesId = c.req.param('seriesId');
  const body = await c.req.json();
  const untilDate = String(body.untilDate || '').trim();
  const fromDate = body.fromDate ? String(body.fromDate).trim() : undefined;
  const overwriteExisting = Boolean(body.overwriteExisting);
  const setAreasMode = (body.setAreasMode === 'replace') ? 'replace' : 'skip';
  if (!isValidDateStr(untilDate)) return c.json({ error: 'invalid untilDate' }, 400);
  const res = await upsertEventsForSeries(seriesId, { fromDate, untilDate, overwriteExisting, setAreasMode });
  return c.json(res, 201);
}


