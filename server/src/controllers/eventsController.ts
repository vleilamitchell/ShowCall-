import { Context } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/eventsRepo';
import { isValidUrl } from '../lib/validators';

function normalize(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return String(v);
}

export async function list(c: Context) {
  const status = c.req.query('status') || undefined;
  const q = c.req.query('q') || undefined;
  const includePast = (c.req.query('includePast') || 'false') === 'true';
  const areaIdParam = c.req.query('areaId') || undefined;
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const areaIds = areaIdParam ? String(areaIdParam).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const rows = await repo.listEvents(db, { status, q, includePast, areaIds, from, to });
  return c.json(rows);
}

export async function create(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const body = await c.req.json();
  const now = new Date();
  const formatDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return c.json({ error: 'Title is required' }, 400);

  let generatedId: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) generatedId = g.crypto.randomUUID();
  if (!generatedId) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) generatedId = nodeCrypto.randomUUID(); } catch {} }
  if (!generatedId) generatedId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const record: repo.NewEventRecord = {
    id: generatedId,
    title,
    promoter: normalize(body.promoter),
    status: (typeof body.status === 'string' && body.status.trim()) || 'planned',
    date: (typeof body.date === 'string' && body.date.trim()) || formatDate(now),
    startTime: (typeof body.startTime === 'string' && body.startTime.trim()) || '00:00',
    endTime: (typeof body.endTime === 'string' && body.endTime.trim()) || '23:59',
    description: normalize(body.description),
    artists: normalize(body.artists),
    ticketUrl: normalize(body.ticketUrl),
    eventPageUrl: normalize(body.eventPageUrl),
    promoAssetsUrl: normalize(body.promoAssetsUrl),
    seriesId: body.seriesId ? String(body.seriesId).trim() : null as any,
    updatedAt: new Date() as any,
  } as any;

  if (!isValidUrl(record.ticketUrl)) return c.json({ error: 'invalid ticketUrl: must be http(s) URL' }, 400);
  if (!isValidUrl(record.eventPageUrl)) return c.json({ error: 'invalid eventPageUrl: must be http(s) URL' }, 400);
  if (!isValidUrl(record.promoAssetsUrl)) return c.json({ error: 'invalid promoAssetsUrl: must be http(s) URL' }, 400);

  const created = await repo.insertEvent(db, record);
  return c.json(created);
}

export async function get(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('eventId');
  const row = await repo.getEventById(db, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function patch(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('eventId');
  const body = await c.req.json();
  const patch: Partial<repo.NewEventRecord> = {};
  const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : String(v)));
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (body.promoter !== undefined) patch.promoter = s(body.promoter) as any;
  if (typeof body.status === 'string') patch.status = body.status.trim();
  if (typeof body.date === 'string') patch.date = body.date.trim();
  if (typeof body.startTime === 'string') patch.startTime = body.startTime.trim();
  if (typeof body.endTime === 'string') patch.endTime = body.endTime.trim();
  if (body.description !== undefined) patch.description = s(body.description) as any;
  if (body.artists !== undefined) patch.artists = s(body.artists) as any;
  if ('ticketUrl' in body) patch.ticketUrl = s(body.ticketUrl) as any;
  if ('eventPageUrl' in body) patch.eventPageUrl = s(body.eventPageUrl) as any;
  if ('promoAssetsUrl' in body) patch.promoAssetsUrl = s(body.promoAssetsUrl) as any;
  (patch as any).updatedAt = new Date();
  if ('ticketUrl' in patch && !isValidUrl((patch as any).ticketUrl)) return c.json({ error: 'invalid ticketUrl: must be http(s) URL' }, 400);
  if ('eventPageUrl' in patch && !isValidUrl((patch as any).eventPageUrl)) return c.json({ error: 'invalid eventPageUrl: must be http(s) URL' }, 400);
  if ('promoAssetsUrl' in patch && !isValidUrl((patch as any).promoAssetsUrl)) return c.json({ error: 'invalid promoAssetsUrl: must be http(s) URL' }, 400);
  const updated = await repo.updateEventById(db, id, patch);
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
}

export async function remove(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('eventId');
  const ok = await repo.deleteEventById(db, id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
}

export async function listShifts(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const id = c.req.param('eventId');
  const rows = await repo.listShiftsByEventId(db, id);
  return c.json(rows);
}


