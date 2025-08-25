import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/positionsController';
import * as ep from '../controllers/employeePositionsController';

export const positionsRouter = new Hono();

positionsRouter.use('*', authMiddleware);

// Scoped under departments
positionsRouter.get('/departments/:departmentId/positions', ctrl.list);
positionsRouter.post('/departments/:departmentId/positions', ctrl.create);
positionsRouter.get('/departments/:departmentId/positions/:positionId/eligible', ep.listEligible);

// Legacy parity: allow POST /positions with departmentId in body
positionsRouter.post('/positions', async (c) => {
  const body = await c.req.json();
  const departmentId = String(body.departmentId || '').trim();
  const name = String(body.name || body.title || '').trim();
  if (!departmentId) return c.json({ error: 'departmentId required' }, 400);
  if (!name) return c.json({ error: 'Name is required' }, 400);
  const created = await (await import('../services/positionsService')).create(departmentId, { name });
  return c.json(created, 200);
});

// Item-level
positionsRouter.patch('/positions/:positionId', ctrl.patch);
positionsRouter.delete('/positions/:positionId', ctrl.remove);
positionsRouter.patch('/positions/:positionId/employee-positions', ep.patch);


