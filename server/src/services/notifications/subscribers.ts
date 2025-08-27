import { getNovuClient } from './novuClient';

export async function ensureSubscriber(userId: string, data?: { email?: string; phone?: string; fcmToken?: string }) {
  const c = getNovuClient();
  if (!c) return null;
  // Create or update subscriber in Novu
  await c.subscribers.identify(userId, {
    email: data?.email,
    phone: data?.phone,
  } as any);
  if (data?.fcmToken) {
    try {
      await c.subscribers.setCredentials(userId, 'fcm', { deviceTokens: [data.fcmToken] } as any);
    } catch {}
  }
  return true;
}


