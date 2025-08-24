import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/eventsController';

export const eventsRouter = new Hono();

eventsRouter.use('*', authMiddleware);

eventsRouter.get('/', ctrl.list);
eventsRouter.post('/', ctrl.create);
eventsRouter.get('/:eventId', ctrl.get);
eventsRouter.patch('/:eventId', ctrl.patch);
eventsRouter.delete('/:eventId', ctrl.remove);
eventsRouter.get('/:eventId/shifts', ctrl.listShifts);


