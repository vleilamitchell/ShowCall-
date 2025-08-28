import { getEnv, isDevelopment } from './env';
import * as admin from 'firebase-admin';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App | null {
  // In development with emulator, there is no Admin delete; return null to no-op
  if (isDevelopment()) return null;
  if (!initialized) {
    const projectId = getEnv('FIREBASE_PROJECT_ID');
    // If credentials are not provided, Admin SDK will try ADC
    try {
      admin.initializeApp({ projectId: projectId || undefined });
      initialized = true;
    } catch (e: any) {
      if (!String(e?.message || '').includes('already exists')) throw e;
      initialized = true;
    }
  }
  return admin.getApps()[0] || admin.getApp();
}

export async function deleteFirebaseUser(userId: string): Promise<void> {
  const app = getFirebaseAdmin();
  if (!app) return; // emulator/no-credentials mode: skip
  try {
    await app.auth().deleteUser(userId);
  } catch (e: any) {
    // If user not found in Firebase, ignore to keep idempotent
    if (!String(e?.errorInfo?.code || e?.message || '').includes('auth/user-not-found')) {
      throw e;
    }
  }
}


