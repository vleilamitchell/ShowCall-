import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/eventAreasController';

export const eventAreasRouter = new Hono();

eventAreasRouter.use('*', authMiddleware);

eventAreasRouter.get('/:eventId/areas', ctrl.list);
eventAreasRouter.put('/:eventId/areas', ctrl.replace);
eventAreasRouter.post('/:eventId/areas', ctrl.add);
eventAreasRouter.delete('/:eventId/areas/:areaId', ctrl.remove);


