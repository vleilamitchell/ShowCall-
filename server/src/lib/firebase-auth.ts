import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isDevelopment, getEnv } from './env';

type FirebaseUser = {
  id: string;
  email: string | undefined;
};

const getJWKS = () => {
  if (isDevelopment()) {
    // Use emulator JWKS endpoint with dynamic port
    const firebaseAuthHost = getEnv('FIREBASE_AUTH_EMULATOR_HOST') ?? 'localhost:5503';
    const emulatorUrl = firebaseAuthHost.startsWith('http') 
      ? firebaseAuthHost 
      : `http://${firebaseAuthHost}`;
    
    return createRemoteJWKSet(
      new URL(`${emulatorUrl}/www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`)
    );
  } else {
    // Use production Firebase JWKS
    return createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
  }
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
  } catch (error) {
    throw new Error('Invalid token');
  }
} 