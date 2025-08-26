import { MiddlewareHandler } from 'hono';
import { verifyFirebaseToken } from '../lib/firebase-auth';
import { getDatabase } from '../lib/db';
import { eq } from 'drizzle-orm';
import { User, users } from '../schema/users';
import { getEnv, getFirebaseProjectId, getDatabaseUrl } from '../lib/env';
import { AuthError } from '../errors';

// Lightweight in-memory cache to avoid frequent DB reads on hot paths
type CachedUser = { user: User; expiresAt: number };
const userCacheById = new Map<string, CachedUser>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const getCachedUserById = (id: string): User | undefined => {
  const entry = userCacheById.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    userCacheById.delete(id);
    return undefined;
  }
  return entry.user;
};

const setCachedUserById = (id: string, user: User): void => {
  userCacheById.set(id, { user, expiresAt: Date.now() + CACHE_TTL_MS });
};

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

// Re-export a friendly alias for controllers/services to reference the auth user type
export type AuthenticatedUser = User;

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    // Test-mode stub path: allow tests to inject a user without JWT
    const nodeEnv = getEnv('NODE_ENV');
    if (nodeEnv === 'test') {
      let stub = (c as any).get?.('testUser') as { userId: string; email?: string } | undefined;
      if (!stub) {
        const hdr = c.req.header('x-test-user');
        if (hdr) {
          try {
            stub = JSON.parse(hdr);
          } catch {
            // ignore malformed header; fall through to normal auth
          }
        }
      }
      if (stub?.userId) {
        const databaseUrl = getDatabaseUrl();
        const db = await getDatabase(databaseUrl!);
        await db
          .insert(users)
          .values({
            id: stub.userId,
            // Ensure non-null email to satisfy schema
            email: stub.email ?? `${stub.userId}@test.local`,
            display_name: null,
            photo_url: null,
          })
          .onConflictDoNothing();

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, stub.userId))
          .limit(1);

        if (!user) {
          throw new Error('Failed to create or retrieve user');
        }

        c.set('user', user);
        return next();
      }
    }

    // Hono normalizes headers to lowercase; read header case-insensitively
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (getEnv('DEBUG_AUTH') === '1') {
        console.warn('[AUTH] Missing/invalid Authorization header', {
          method: c.req.method,
          path: c.req.path,
          origin: c.req.header('origin'),
          requestId: (c as any).get?.('requestId') || undefined,
        });
      }
      throw new AuthError('Missing or invalid Authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const firebaseProjectId = getFirebaseProjectId();
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(token, firebaseProjectId);
    } catch (e: any) {
      if (getEnv('DEBUG_AUTH') === '1') {
        console.error('[AUTH] verifyFirebaseToken failed', {
          requestId: (c as any).get?.('requestId') || undefined,
          reason: e?.message || String(e),
          projectId: firebaseProjectId,
        });
      }
      throw e;
    }

    const databaseUrl = getDatabaseUrl();
    const db = await getDatabase(databaseUrl);

    // Fast-path: return cached user if available
    const cached = getCachedUserById(firebaseUser.id);
    if (cached) {
      c.set('user', cached);
      return next();
    }

    // Attempt single-roundtrip insert with DO NOTHING; return row if inserted
    let user: User | undefined;
    try {
      const inserted = await (db as any)
        .insert(users)
        .values({
          id: firebaseUser.id,
          email: firebaseUser.email!,
          display_name: null,
          photo_url: null,
        })
        .onConflictDoNothing()
        .returning();

      if (Array.isArray(inserted) && inserted.length > 0) {
        user = inserted[0] as User;
      }
    } catch (e: any) {
      if (getEnv('DEBUG_AUTH') === '1') {
        console.error('[AUTH] DB insert users failed', { reason: e?.message || String(e) });
      }
      throw e;
    }

    // If not inserted (already exists), fetch by id then email as legacy fallback
    if (!user) {
      try {
        const rowsById = await db.select()
          .from(users)
          .where(eq(users.id, firebaseUser.id))
          .limit(1);
        user = rowsById[0];
      } catch (e: any) {
        if (getEnv('DEBUG_AUTH') === '1') {
          console.error('[AUTH] DB select user by id failed', { reason: e?.message || String(e) });
        }
        throw e;
      }
    }

    // Fallback: legacy datasets may have a different user id but same email (unique)
    if (!user && firebaseUser.email) {
      try {
        const rows = await db.select()
          .from(users)
          .where(eq(users.email, firebaseUser.email))
          .limit(1);
        user = rows[0];
        if (getEnv('DEBUG_AUTH') === '1' && user) {
          console.warn('[AUTH] Using email-based user mapping due to id mismatch', {
            tokenUserId: firebaseUser.id,
            mappedUserId: user.id,
          });
        }
      } catch (e: any) {
        if (getEnv('DEBUG_AUTH') === '1') {
          console.error('[AUTH] DB email lookup failed', { reason: e?.message || String(e) });
        }
        throw e;
      }
    }

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    setCachedUserById(user.id, user);
    c.set('user', user);
    await next();
  } catch (error: any) {
    // If verification failed or header missing, return 401. Otherwise, rethrow to be handled upstream.
    const msg = String(error?.message || error);
    const isAuthProblem =
      msg.includes('Missing or invalid Authorization header') ||
      msg.includes('Invalid token') ||
      msg.includes('Invalid emulator token') ||
      msg.includes('Failed to create or retrieve user');

    if (getEnv('DEBUG_AUTH') === '1') {
      console.error('[AUTH] Auth middleware error', {
        requestId: (c as any).get?.('requestId') || undefined,
        reason: msg,
      });
    }

    if (isAuthProblem) {
      throw new AuthError('Unauthorized');
    }
    // Non-auth errors should not be mapped to 401
    throw error;
  }
}; 