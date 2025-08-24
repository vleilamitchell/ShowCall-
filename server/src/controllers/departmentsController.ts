import { Context } from 'hono';
import * as service from '../services/departmentsService';

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const rows = await service.list({ q });
  return c.json(rows);
}

export async function create(c: Context) {
  const body = await c.req.json();
  try {
    const created = await service.create({ name: String(body.name || ''), description: body.description });
    return c.json(created, 200);
  } catch (e: any) {
    if (String(e?.message) === 'Name is required') return c.json({ error: 'Name is required' }, 400);
    throw e;
  }
}

export async function get(c: Context) {
  const id = c.req.param('departmentId');
  try {
    const row = await service.get(id);
    return c.json(row);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('departmentId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(id, body);
    return c.json(updated);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}


