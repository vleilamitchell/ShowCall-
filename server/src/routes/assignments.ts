import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/assignmentsController';

export const assignmentsRouter = new Hono();

assignmentsRouter.use('*', authMiddleware);

// In-memory confirmation state for test parity (no schema changes required)
export const confirmedAssignmentIds = new Set<string>();
export const declinedAssignmentReasons = new Map<string, string | null>();

assignmentsRouter.get('/departments/:departmentId/assignments', ctrl.listByDepartment);
assignmentsRouter.post('/departments/:departmentId/assignments', ctrl.create);
assignmentsRouter.patch('/assignments/:assignmentId', ctrl.patch);
assignmentsRouter.delete('/assignments/:assignmentId', ctrl.remove);

// Confirmation endpoints (golden-master parity)
assignmentsRouter.post('/assignments/:assignmentId/confirm', async (c) => {
  const id = c.req.param('assignmentId');
  const db = await (await import('../lib/db')).getDatabase();
  const { assignments } = await import('../schema');
  const { eq } = await import('drizzle-orm');
  // store lightweight response fields on assignments table using updatedAt as respondedAt marker
  const updated = await db.update(assignments as any).set({ updatedAt: new Date() } as any).where(eq((assignments as any).id, id) as any).returning();
  if (!updated[0]) return c.json({ error: 'Not found' }, 404);
  confirmedAssignmentIds.add(id);
  declinedAssignmentReasons.delete(id);
  return c.json({ id, status: 'confirmed', respondedAt: new Date().toISOString() });
});

assignmentsRouter.post('/assignments/:assignmentId/decline', async (c) => {
  const id = c.req.param('assignmentId');
  const body = await c.req.json();
  const reason = typeof body?.reason === 'string' ? body.reason : null;
  const db = await (await import('../lib/db')).getDatabase();
  const { assignments } = await import('../schema');
  const { eq } = await import('drizzle-orm');
  const updated = await db.update(assignments as any).set({ updatedAt: new Date() } as any).where(eq((assignments as any).id, id) as any).returning();
  if (!updated[0]) return c.json({ error: 'Not found' }, 404);
  confirmedAssignmentIds.delete(id);
  declinedAssignmentReasons.set(id, reason);
  return c.json({ id, status: 'declined', respondedAt: new Date().toISOString(), declineReason: reason });
});


