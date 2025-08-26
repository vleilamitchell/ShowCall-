import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/eventAreasController';

export const eventAreasRouter = new Hono();

eventAreasRouter.use('*', authMiddleware);

// Bulk fetch areas for multiple events: GET /events/_bulk/areas?ids=evt1,evt2,...
eventAreasRouter.get('/_bulk/areas', ctrl.listForMany);

eventAreasRouter.get('/:eventId/areas', ctrl.list);
eventAreasRouter.put('/:eventId/areas', ctrl.replace);
eventAreasRouter.post('/:eventId/areas', ctrl.add);
eventAreasRouter.delete('/:eventId/areas/:areaId', ctrl.remove);


