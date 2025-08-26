import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import firebaseConfig from '../../firebase-config.json';


// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
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
  }
}

if (typeof window !== 'undefined') {
  try {
    window.__scAuth = auth;
    window.__scGetToken = async () => {
      const user = getAuth(app).currentUser;
      return user ? await user.getIdToken(true) : null;
    };
    // eslint-disable-next-line no-console
    console.log('🔎 Exposed __scAuth and __scGetToken for debugging');
  } catch {}
}