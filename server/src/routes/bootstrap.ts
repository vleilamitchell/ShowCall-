import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/eventsPageController';

export const bootstrapRouter = new Hono();

bootstrapRouter.use('*', authMiddleware);

// GET /bootstrap/events — initial payload for events page
bootstrapRouter.get('/events', ctrl.events);
// GET /bootstrap/event-detail?eventId=... — optimized detail payload
bootstrapRouter.get('/event-detail', ctrl.eventDetail);
// GET /bootstrap/schedule-detail?scheduleId=...&departmentId=... — optimized schedule detail payload
bootstrapRouter.get('/schedule-detail', ctrl.scheduleDetail);


