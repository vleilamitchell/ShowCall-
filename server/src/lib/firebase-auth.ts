import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isDevelopment, getEnv } from './env';

type FirebaseUser = {
  id: string;
  email: string | undefined;
};

// Memoize JWKS instances so key metadata and HTTP caching persist across requests
let cachedProdJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedEmulatorJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJWKS = () => {
  if (isDevelopment()) {
    if (!cachedEmulatorJWKS) {
      // Use emulator JWKS endpoint with dynamic port
      const firebaseAuthHost = getEnv('FIREBASE_AUTH_EMULATOR_HOST') ?? 'localhost:5503';
      const emulatorUrl = firebaseAuthHost.startsWith('http')
        ? firebaseAuthHost
        : `http://${firebaseAuthHost}`;

      cachedEmulatorJWKS = createRemoteJWKSet(
        new URL(`${emulatorUrl}/www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`)
      );
    }
    return cachedEmulatorJWKS;
  }

  if (!cachedProdJWKS) {
    // Use production Firebase JWKS
    cachedProdJWKS = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
  }
  return cachedProdJWKS;
};

export async function verifyFirebaseToken(token: string, projectId: string): Promise<FirebaseUser> {
  if (!projectId) {
    // In tests/emulator, allow missing project id
    if (!isDevelopment()) throw new Error('FIREBASE_PROJECT_ID environment variable is not set');
  }

  // In emulator mode, use simplified token verification
  if (isDevelopment()) {
    try {
      // Decode the token without verification for emulator
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(b64, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      
      // Basic validation for emulator tokens
      // In emulator/test, relax audience to reduce flakiness across files
      if (!payload.sub) throw new Error('Invalid token payload');
      
      return {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };
    } catch (error) {
      throw new Error('Invalid emulator token');
    }
  }

  // Production token verification
  try {
    const JWKS = getJWKS();
    const issuer = `https://securetoken.google.com/${projectId}`;

    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: projectId,
    });

    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
    };
  } catch (error: any) {
    if (getEnv('DEBUG_AUTH') === '1') {
      try {
        // Best-effort decode header/payload for diagnostics without secrets
        const parts = token.split('.')
        const payloadStr = parts[1] ? Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '{}';
        const payload = JSON.parse(payloadStr);
        console.error('[AUTH] Token verification failed', {
          reason: error?.message || String(error),
          expectedIssuer: `https://securetoken.google.com/${projectId}`,
          expectedAudience: projectId,
          tokenIss: payload.iss,
          tokenAud: payload.aud,
          tokenSubPresent: !!payload.sub,
          tokenIat: payload.iat,
          tokenExp: payload.exp,
        });
      } catch (e) {
        console.error('[AUTH] Token verification failed; unable to decode payload', { reason: error?.message || String(error) });
      }
    }
    throw new Error('Invalid token');
  }
} 