import { Context } from 'hono';
import * as service from '../services/areasService';

export async function reorder(c: Context) {
  const body = await c.req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
  if (ids.length === 0) return c.json({ error: 'ids required' }, 400);
  try {
    const rows = await service.reorder(ids);
    return c.json(rows);
  } catch (e: any) {
    if (String(e?.code) === 'BadRequest') return c.json({ error: 'Unknown ids', details: e.details }, 400);
    throw e;
  }
}

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const activeParam = c.req.query('active');
  const active = activeParam == null ? undefined : activeParam === 'true';
  const rows = await service.list({ q, active: active as any });
  return c.json(rows);
}

export async function create(c: Context) {
  const body = await c.req.json();
  try {
    const created = await service.create({
      name: String(body.name || ''),
      description: typeof body.description === 'string' ? body.description : null,
      color: typeof body.color === 'string' ? body.color : null,
      active: body.active == null ? true : Boolean(body.active),
    });
    return c.json(created, 201);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'invalid name') return c.json({ error: 'invalid name' }, 400);
    if (msg === 'invalid color') return c.json({ error: 'invalid color' }, 400);
    if (String(e?.code) === 'Conflict') return c.json({ error: 'Name must be unique' }, 409);
    throw e;
  }
}

export async function patch(c: Context) {
  const areaId = c.req.param('areaId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(areaId, body);
    return c.json(updated);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'invalid name') return c.json({ error: 'invalid name' }, 400);
    if (msg === 'invalid color') return c.json({ error: 'invalid color' }, 400);
    if (String(e?.code) === 'Conflict') return c.json({ error: 'Name must be unique' }, 409);
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function remove(c: Context) {
  const areaId = c.req.param('areaId');
  try {
    await service.remove(areaId);
    return c.body(null, 204);
  } catch (e: any) {
    if (String(e?.code) === 'AreaInUse') return c.json({ error: 'AreaInUse' }, 409);
    throw e;
  }
}


