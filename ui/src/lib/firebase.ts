import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-config.json';


// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Ensure auth state persists and is restored reliably across reloads
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();

// Connect to Firebase Auth emulator only when explicitly enabled
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    const firebaseAuthPort = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9099';
    const emulatorUrl = `http://localhost:${firebaseAuthPort}`;
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    console.log(`🧪 Connected to Firebase Auth emulator at ${emulatorUrl}`);
  } catch (error) {
    // Emulator already connected or not available
    console.debug('Firebase Auth emulator connection skipped:', error);
  }
} else {
  console.log(`🏭 Using production Firebase Auth (Project: ${firebaseConfig.projectId})`);
} 

// Optional debug exposure for console-based diagnostics
declare global {
  interface Window {
    __scAuth?: ReturnType<typeof getAuth>;
    __scGetToken?: () => Promise<string | null>;
    __scDebugAuth?: () => Promise<any>;
  }
}

if (typeof window !== 'undefined') {
  try {
    window.__scAuth = auth;
    window.__scGetToken = async () => {
      const user = getAuth(app).currentUser;
      return user ? await user.getIdToken(true) : null;
    };
    window.__scDebugAuth = async () => {
      const out: any = {
        appName: app.name,
        projectId: (app.options as any)?.projectId,
        hasAuth: !!auth,
        currentUserNull: auth.currentUser == null,
      };
      if (!auth.currentUser) {
        out.waitedForUser = true;
        const user = await new Promise<any>((resolve) => {
          const t = setTimeout(() => { try { unsub(); } catch {} ; resolve(null); }, 3000);
          const unsub = onAuthStateChanged(auth, (u: any) => { clearTimeout(t); try { unsub(); } catch {} ; resolve(u); });
        });
        out.userAfterWait = !!user;
      }
      if (auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          out.tokenPrefix = token.slice(0, 12);
          out.tokenLength = token.length;
        } catch (e: any) {
          out.tokenError = String(e?.message || e);
        }
      }
      return out;
    };
    // eslint-disable-next-line no-console
    console.log('🔎 Exposed __scAuth and __scGetToken for debugging');
  } catch {}
}