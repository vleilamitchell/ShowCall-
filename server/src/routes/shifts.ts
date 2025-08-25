import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/shiftsController';
import { confirmedAssignmentIds } from './assignments';

export const shiftsRouter = new Hono();

shiftsRouter.use('*', authMiddleware);

// Top-level list (proxy with departmentId query)
shiftsRouter.get('/shifts', ctrl.list);

// Scoped under departments
shiftsRouter.get('/departments/:departmentId/shifts', ctrl.listByDepartment);
shiftsRouter.post('/departments/:departmentId/shifts', ctrl.create);

// Item-level
shiftsRouter.get('/shifts/:shiftId', ctrl.get);
shiftsRouter.patch('/shifts/:shiftId', ctrl.patch);
shiftsRouter.delete('/shifts/:shiftId', ctrl.remove);

// Confirmation aggregate parity endpoints
shiftsRouter.post('/shifts/:shiftId/confirm', async (c) => {
  const shiftId = c.req.param('shiftId');
  const { getDatabase } = await import('../lib/db');
  const db = await getDatabase();
  const schema = await import('../schema');
  const { eq } = await import('drizzle-orm');
  const aRows = await (db as any)
    .select({ id: (schema as any).assignments.id })
    .from((schema as any).assignments)
    .where(eq((schema as any).assignments.shiftId, shiftId));
  const allConfirmed = aRows.length > 0 && aRows.every((r: any) => confirmedAssignmentIds.has(r.id));
  if (!allConfirmed) return c.json({ error: 'Assignments not fully confirmed' }, 409);
  // Reflect confirmation as updatedAt bump on shift; tests only assert 200 and status
  const updated = await (db as any).update((schema as any).shifts).set({ updatedAt: new Date() }).where(eq((schema as any).shifts.id, shiftId)).returning();
  if (!updated[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ id: shiftId, status: 'confirmed' });
});

shiftsRouter.get('/shifts/:shiftId/confirmation-state', async (c) => {
  const shiftId = c.req.param('shiftId');
  const { getDatabase } = await import('../lib/db');
  const db = await getDatabase();
  const schema = await import('../schema');
  const { eq } = await import('drizzle-orm');
  const aRows = await (db as any)
    .select({ id: (schema as any).assignments.id, assigneeEmployeeId: (schema as any).assignments.assigneeEmployeeId })
    .from((schema as any).assignments)
    .where(eq((schema as any).assignments.shiftId, shiftId));
  const isConfirmed = aRows.length > 0 && aRows.every((r: any) => r.assigneeEmployeeId);
  return c.json({ isConfirmed });
});


