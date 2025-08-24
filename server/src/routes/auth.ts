import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as authController from '../controllers/authController';

export const authRouter = new Hono();

// Apply auth at the router boundary
authRouter.use('*', authMiddleware);

// GET /protected/me (mounted under /protected by the caller)
authRouter.get('/me', authController.me);


