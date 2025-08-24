import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/schedulesController';

export const schedulesRouter = new Hono();

schedulesRouter.use('*', authMiddleware);

schedulesRouter.get('/schedules', ctrl.list);
schedulesRouter.post('/schedules', ctrl.create);
schedulesRouter.get('/schedules/:scheduleId', ctrl.get);
schedulesRouter.patch('/schedules/:scheduleId', ctrl.patch);
schedulesRouter.post('/schedules/:scheduleId/publish', ctrl.publish);
schedulesRouter.post('/schedules/:scheduleId/unpublish', ctrl.unpublish);
schedulesRouter.post('/schedules/:scheduleId/generate-shifts', ctrl.generateShifts);


