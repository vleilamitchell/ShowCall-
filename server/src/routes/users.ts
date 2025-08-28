import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { upsertPushToken } from '../repositories/pushTokensRepo';
import { ensureSubscriber } from '../services/notifications/subscribers';
import * as ctrl from '../controllers/usersController';

export const usersRouter = new Hono();

usersRouter.use('*', authMiddleware);

// Users management
usersRouter.get('/users', ctrl.list);
usersRouter.get('/users/:userId', ctrl.get);
usersRouter.patch('/users/:userId', ctrl.patch);
usersRouter.delete('/users/:userId', ctrl.remove);

// POST /me/push-tokens { token, provider, platform }
usersRouter.post('/me/push-tokens', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const provider = (String(body.provider || 'fcm').trim().toLowerCase()) as 'fcm' | 'apns' | 'webpush';
  const platform = (String(body.platform || 'web').trim().toLowerCase()) as 'web' | 'ios' | 'android';
  if (!token) return c.json({ error: 'token required' }, 400);
  const db = await getDatabase(getDatabaseUrl());
  let id: string | undefined = (globalThis as any)?.crypto?.randomUUID?.();
  if (!id) { try { const nc = await import('node:crypto'); if ((nc as any).randomUUID) id = (nc as any).randomUUID(); } catch {} }
  if (!id) id = `ptk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const row = await upsertPushToken(db, { id, userId: user.id, provider, token, platform, lastSeenAt: new Date() });
  await ensureSubscriber(user.id, { email: user.email as any, fcmToken: provider === 'fcm' ? token : undefined });
  return c.json(row, 201);
});


