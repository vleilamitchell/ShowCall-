import buildApp from '../app';

type BuildOptions = {
  stubAuth?: { userId: string; email?: string } | null;
  logRequests?: boolean;
};

export function buildTestApp(options: BuildOptions = {}) {
  const app = buildApp({ injectAuth: options.stubAuth ?? undefined, disableLogger: !options.logRequests });
  return app as any;
}

export function makeEmulatorJwt(payload: Record<string, any>) {
  // Unsigned JWT-like structure suitable for emulator path in verifyFirebaseToken
  const base64url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = { alg: 'none', typ: 'JWT' };
  const p = base64url(header) + '.' + base64url(payload) + '.dummy';
  return p;
}


