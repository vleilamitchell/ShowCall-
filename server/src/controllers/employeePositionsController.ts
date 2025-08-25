import { Context } from 'hono';
import * as service from '../services/employeePositionsService';

export async function create(c: Context) {
  const body = await c.req.json();
  try {
    const created = await service.create({
      departmentId: String(body.departmentId || ''),
      employeeId: String(body.employeeId || ''),
      positionId: String(body.positionId || ''),
      priority: body.priority == null ? null : Number(body.priority),
      isLead: Boolean(body.isLead),
    });
    return c.json(created, 200);
  } catch (e: any) {
    if (String(e?.message).includes('required')) return c.json({ error: String(e.message) }, 400);
    throw e;
  }
}

export async function patch(c: Context) {
  const positionId = c.req.param('positionId');
  const body = await c.req.json();
  try {
    const updated = await service.batchUpdateForPosition(positionId, body.items);
    return c.json(updated, 200);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'items required' || msg === 'Items must belong to the position') {
      return c.json({ error: msg }, 400);
    }
    throw e;
  }
}

export async function listEligible(c: Context) {
  const departmentId = c.req.param('departmentId');
  const positionId = c.req.param('positionId');
  const rows = await service.listEligible(departmentId, positionId);
  return c.json(rows);
}

export async function listByDepartment(c: Context) {
  const departmentId = c.req.param('departmentId');
  const rows = await service.listByDepartment(departmentId);
  return c.json(rows);
}

export async function removeById(c: Context) {
  const id = c.req.param('employeePositionId');
  const ok = await service.removeById(id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
}

export async function removeByComposite(c: Context) {
  const departmentId = c.req.param('departmentId');
  const positionId = c.req.param('positionId');
  const employeeId = c.req.param('employeeId');
  const ok = await service.removeByComposite(departmentId, positionId, employeeId);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
}


