import { Context } from 'hono';
import * as service from '../services/employeesService';

export async function listByDepartment(c: Context) {
  try {
    const departmentId = c.req.param('departmentId');
    const rows = await service.listByDepartment(departmentId);
    return c.json(rows);
  } catch (error) {
    console.error('List employees by department error:', error);
    return c.json({ error: 'Failed to list employees' }, 500);
  }
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
  const id = c.req.param('employeeId');
  const body = await c.req.json();
  try {
    const updated = await service.patch(id, body);
    return c.json(updated, 200);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('employeeId');
  await service.remove(id);
  return c.body(null, 204);
}

export async function createAccount(c: Context) {
  const id = c.req.param('employeeId');
  try {
    const result = await service.createAccountForEmployee(id);
    return c.json(result, 200);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('not found')) return c.json({ error: 'Not found' }, 404);
    if (msg.includes('email required') || msg.includes('admin not available')) return c.json({ error: msg }, 400);
    throw e;
  }
}

export async function linkAccount(c: Context) {
  const id = c.req.param('employeeId');
  const body = await c.req.json().catch(() => ({}));
  try {
    const result = await service.linkEmployeeToAccount(id, { userId: body.userId, email: body.email });
    return c.json(result, 200);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('not found')) return c.json({ error: 'Not found' }, 404);
    if (msg.includes('User not found') || msg.includes('email required') || msg.includes('No account found')) return c.json({ error: msg }, 400);
    throw e;
  }
}


