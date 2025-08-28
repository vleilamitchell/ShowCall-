import { Context } from 'hono';
import * as service from '../services/usersService';

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const rows = await service.list({ q });
  return c.json(rows);
}

export async function get(c: Context) {
  const id = c.req.param('userId');
  try {
    const row = await service.get(id);
    return c.json(row);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('userId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(id, body);
    return c.json(updated);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('userId');
  try {
    await service.remove(id);
    return c.body(null, 204);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}


