import { Context } from 'hono';
import * as service from '../services/assignmentsService';

export async function listByDepartment(c: Context) {
  const departmentId = c.req.param('departmentId');
  const shiftId = c.req.query('shiftId') || undefined;
  const rows = await service.listByDepartment(departmentId, { shiftId });
  return c.json(rows);
}

export async function create(c: Context) {
  const departmentId = c.req.param('departmentId');
  const body = await c.req.json();
  try {
    const created = await service.create(departmentId, body);
    return c.json(created, 200);
  } catch (e: any) {
    if (String(e?.message).includes('required')) return c.json({ error: String(e.message) }, 400);
    throw e;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('assignmentId');
  const body = await c.req.json();
  const updated = await service.patch(id, body);
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
}

export async function remove(c: Context) {
  const id = c.req.param('assignmentId');
  await service.remove(id);
  return c.body(null, 204);
}


