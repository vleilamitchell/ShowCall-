import { MiddlewareHandler } from 'hono';
import { verifyFirebaseToken } from '../lib/firebase-auth';
import { getDatabase } from '../lib/db';
import { eq } from 'drizzle-orm';
import { User, users } from '../schema/users';
import { getEnv, getFirebaseProjectId, getDatabaseUrl } from '../lib/env';
import { AuthError } from '../errors';

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
            email: stub.email ?? null,
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

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid Authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const firebaseProjectId = getFirebaseProjectId();
    const firebaseUser = await verifyFirebaseToken(token, firebaseProjectId);

    const databaseUrl = getDatabaseUrl();
    const db = await getDatabase(databaseUrl);

    // Upsert: insert if not exists, do nothing if exists
    await db.insert(users)
      .values({
        id: firebaseUser.id,
        email: firebaseUser.email!,
        display_name: null,
        photo_url: null,
      })
      .onConflictDoNothing();

    // Get the user (either just created or already existing)
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, firebaseUser.id))
      .limit(1);

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    c.set('user', user);
    await next();
  } catch (error) {
    throw new AuthError('Unauthorized');
  }
}; 