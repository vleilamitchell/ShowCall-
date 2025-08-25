import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/employeesController';

export const employeesRouter = new Hono();

employeesRouter.use('*', authMiddleware);

// Scoped under departments
employeesRouter.get('/departments/:departmentId/employees', ctrl.listByDepartment);
employeesRouter.post('/departments/:departmentId/employees', ctrl.create);

// Legacy parity: allow POST /employees with departmentId in body
employeesRouter.post('/employees', async (c) => {
  const body = await c.req.json();
  const departmentId = String(body.departmentId || '').trim();
  if (!departmentId) return c.json({ error: 'departmentId required' }, 400);
  try {
    const created = await (await import('../services/employeesService')).create(departmentId, body);
    return c.json(created, 200);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('required')) return c.json({ error: msg }, 400);
    throw e;
  }
});

// Item-level
employeesRouter.patch('/employees/:employeeId', ctrl.patch);
employeesRouter.delete('/employees/:employeeId', ctrl.remove);


