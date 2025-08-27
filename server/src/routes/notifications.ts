import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/notificationsController';

export const notificationsRouter = new Hono();

// Keep behind auth but under /internal to reduce exposure
notificationsRouter.use('*', authMiddleware);
notificationsRouter.post('/internal/notifications/test', ctrl.testSend);


