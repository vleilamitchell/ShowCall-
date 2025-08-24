import { Context } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/eventAreasRepo';

export async function list(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const eventId = c.req.param('eventId');
  const rows = await repo.listAreasForEvent(db, eventId);
  return c.json(rows);
}

export async function replace(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const incomingIds: string[] = Array.isArray(body.areaIds) ? Array.from(new Set(body.areaIds.map((s: any) => String(s || '').trim()).filter(Boolean))) : [];
  try {
    const rows = await repo.replaceAreasForEvent(db, eventId, incomingIds);
    return c.json(rows);
  } catch (e: any) {
    if (String(e?.code) === 'UnknownAreaIds') return c.json({ error: 'Unknown areaIds', details: e.details }, 400);
    throw e;
  }
}

export async function add(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const areaId = String(body.areaId || '').trim();
  if (!areaId) return c.json({ error: 'areaId required' }, 400);
  try {
    const rows = await repo.addAreaToEvent(db, eventId, areaId);
    return c.json(rows, 201);
  } catch (e: any) {
    if (String(e?.code) === 'AreaNotFound') return c.json({ error: 'Area not found' }, 404);
    throw e;
  }
}

export async function remove(c: Context) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const eventId = c.req.param('eventId');
  const areaId = c.req.param('areaId');
  await repo.removeAreaFromEvent(db, eventId, areaId);
  return c.body(null, 204);
}


