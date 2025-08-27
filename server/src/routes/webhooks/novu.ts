import { Hono } from 'hono';
import * as ctrl from '../../controllers/webhooks/novuController';

export const novuWebhookRouter = new Hono();

// Webhooks are generally unauthenticated but should be protected via secret or signature verification.
novuWebhookRouter.post('/webhooks/novu', ctrl.handleWebhook);


