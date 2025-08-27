import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export async function initPush(): Promise<string | null> {
  if (!(await isSupported())) return null;
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY not set; push disabled');
    return null;
  }
  const messaging = getMessaging(app);
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) await registerToken(token);
    return token;
  } catch (e) {
    console.warn('Failed to get FCM token', e);
    return null;
  }
}

async function registerToken(token: string) {
  try {
    const resp = await fetch(`/api/v1/me/push-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, provider: 'fcm', platform: 'web' }),
    });
    if (!resp.ok) {
      console.warn('Register token failed', await resp.text());
    }
  } catch (e) {
    console.warn('Register token error', e);
  }
}

export function onPushMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return;
  isSupported().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => callback(payload));
  });
}


