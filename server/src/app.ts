import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { mountV1Routers } from './routes';
import { setEnvContext } from './lib/env';
import { requestContext } from './middleware/requestContext';
import { errorHandler } from './middleware/errorHandler';
import { error as errorBody } from './http/responses';
import { mapErrorToResponse } from './errors';

export type BuildAppOptions = {
  injectAuth?: { userId: string; email?: string } | null;
  disableLogger?: boolean;
};

/**
 * buildApp wires the base Hono app with shared middleware, error handling,
 * and mounts the legacy api routes without changing behavior.
 */
export function buildApp(options: BuildAppOptions = {}) {
  const app = new Hono();

  // Ensure env context is available for libraries that read via lib/env
  if (typeof process !== 'undefined' && process.env) {
    setEnvContext(process.env);
  }

  // Request context first so requestId/startedAt are available everywhere
  app.use('*', requestContext);
  if (!options.disableLogger) {
    app.use('*', logger());
  }
  app.use('*', cors({
    // Allow the Static Web App origin in production; '*' is acceptable if no credentials are used
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Explicitly allow Authorization for Firebase ID tokens and Content-Type for JSON bodies
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  }));

  // Global notFound and onError for consistent error envelopes
  app.notFound((c) => c.json(errorBody('not_found', 'Not Found'), 404));
  app.onError((err, c) => {
    const mapped = mapErrorToResponse(err);
    return c.json(mapped.body, mapped.status);
  });

  // Route-level error handler wrapper
  app.use('*', errorHandler);

  // Public health endpoint (no auth)
  app.get('/healthz', (c) => c.json({ ok: true }));

  // Build API v1 router composition and mount under /api/v1
  const api = new Hono();
  mountV1Routers(api);
  app.route('/api/v1', api);

  // For tests: allow injecting a stub user via header or c.set in test harness
  if (options.injectAuth) {
    const original = (app as any).request?.bind(app) ?? (api as any).request?.bind(api);
    if (original) {
      (app as any).request = (input: any, init?: RequestInit) => {
        const baseHeaders = (init?.headers || {}) as Record<string, string>;
        const mergedInit = {
          ...init,
          headers: {
            ...baseHeaders,
            'x-test-user': JSON.stringify(options.injectAuth),
          },
        } as RequestInit;
        return original(input, mergedInit);
      };
    }
  }

  return app;
}

export default buildApp;


