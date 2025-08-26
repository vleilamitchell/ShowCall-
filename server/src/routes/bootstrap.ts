import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/bootstrapController';

export const bootstrapRouter = new Hono();

bootstrapRouter.use('*', authMiddleware);

// GET /bootstrap/events — initial payload for events page
bootstrapRouter.get('/events', ctrl.events);


