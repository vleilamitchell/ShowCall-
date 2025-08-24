import { Context } from 'hono';
import * as service from '../services/shiftsService';

export async function listByDepartment(c: Context) {
  const departmentId = c.req.param('departmentId');
  const q = c.req.query('q') || undefined;
  const scheduleId = c.req.query('scheduleId') || undefined;
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const published = c.req.query('published') ?? null;
  const rows = await service.listByDepartment(departmentId, { q, scheduleId, from, to, published });
  return c.json(rows);
}

export async function create(c: Context) {
  const departmentId = c.req.param('departmentId');
  const body = await c.req.json();
  try {
    const created = await service.create(departmentId, body);
    return c.json(created, 201);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.startsWith('invalid') || msg.includes('must be')) return c.json({ error: msg }, 400);
    throw e;
  }
}

export async function get(c: Context) {
  const id = c.req.param('shiftId');
  const row = await service.get(id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function patch(c: Context) {
  const id = c.req.param('shiftId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(id, body);
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(updated);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.startsWith('invalid') || msg.includes('must be')) return c.json({ error: msg }, 400);
    throw e;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('shiftId');
  await service.remove(id);
  return c.body(null, 204);
}


