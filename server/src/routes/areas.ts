import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/areasController';

export const areasRouter = new Hono();

areasRouter.use('*', authMiddleware);

areasRouter.patch('/order', ctrl.reorder);
areasRouter.get('/', ctrl.list);
areasRouter.post('/', async (c) => {
  const body = await c.req.json();
  // Legacy parity: accept explicit id if provided
  if (body && typeof body.id === 'string' && body.id.trim()) {
    try {
      const created = await (await import('../services/areasService')).create({
        id: body.id.trim(),
        name: String(body.name || ''),
        description: typeof body.description === 'string' ? body.description : null,
        color: typeof body.color === 'string' ? body.color : null,
        active: body.active == null ? true : Boolean(body.active),
      });
      return c.json(created, 201);
    } catch (e: any) {
      // fall back to default handler below
    }
  }
  return ctrl.create(c);
});
areasRouter.patch('/:areaId', ctrl.patch);
areasRouter.delete('/:areaId', ctrl.remove);



