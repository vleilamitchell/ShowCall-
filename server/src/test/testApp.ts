import buildApp from '../app';
import { setEnvContext } from '../lib/env';

type BuildOptions = {
  stubAuth?: { userId: string; email?: string } | null;
  logRequests?: boolean;
};

export function buildTestApp(options: BuildOptions = {}) {
  // Ensure env context reflects test environment and current process env
  const mergedEnv = {
    ...process.env,
    NODE_ENV: 'test',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'http://localhost:9099',
  } as any;
  setEnvContext(mergedEnv);
  const app = buildApp({ injectAuth: options.stubAuth ?? undefined, disableLogger: !options.logRequests });
  // buildApp sets env context from process.env; re-apply test overrides for downstream reads
  setEnvContext(mergedEnv);
  return app as any;
}

export function makeEmulatorJwt(payload: Record<string, any>) {
  // Unsigned JWT-like structure suitable for emulator path in verifyFirebaseToken
  const base64url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = { alg: 'none', typ: 'JWT' };
  const p = base64url(header) + '.' + base64url(payload) + '.dummy';
  return p;
}


