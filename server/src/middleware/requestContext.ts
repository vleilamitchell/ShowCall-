import { MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    startedAt: number;
    userId?: string;
  }
}

function generateRequestId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const requestContext: MiddlewareHandler = async (c, next) => {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.set('startedAt', Date.now());
  await next();
};


