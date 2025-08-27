import { Context } from 'hono';
import * as service from '../services/schedulesService';

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const isPublishedParam = c.req.query('isPublished');
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const isPublished = isPublishedParam != null ? isPublishedParam === 'true' : null;
  const rows = await service.list({ q, isPublished, from, to });
  return c.json(rows);
}

export async function create(c: Context) {
  const body = await c.req.json();
  try {
    const created = await service.create({ name: String(body.name || ''), startDate: String(body.startDate || ''), endDate: String(body.endDate || '') });
    return c.json(created, 200);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('required') || msg.includes('invalid') || msg.includes('must be')) return c.json({ error: msg }, 400);
    throw e;
  }
}

export async function get(c: Context) {
  const id = c.req.param('scheduleId');
  try {
    const row = await service.get(id);
    return c.json(row);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('scheduleId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(id, body);
    return c.json(updated);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('invalid') || msg.includes('must be')) return c.json({ error: msg }, 400);
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function publish(c: Context) {
  const id = c.req.param('scheduleId');
  try {
    const updated = await service.setPublished(id, true);
    return c.json(updated);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function unpublish(c: Context) {
  const id = c.req.param('scheduleId');
  try {
    const updated = await service.setPublished(id, false);
    return c.json(updated);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function generateShifts(c: Context) {
  const id = c.req.param('scheduleId');
  const body = await c.req.json();
  try {
    const res = await service.generateShifts(id, String(body.departmentId || ''), Boolean(body.regenerate));
    return c.json(res, 201);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'departmentId required') return c.json({ error: msg }, 400);
    if (msg.startsWith('Schedule')) return c.json({ error: msg }, msg.includes('not found') ? 404 : 400);
    throw e;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('scheduleId');
  try {
    await service.remove(id);
    return c.body(null, 204);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}


