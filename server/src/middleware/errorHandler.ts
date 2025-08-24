import { MiddlewareHandler } from 'hono';
import { AppError, mapErrorToResponse } from '../errors';

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const mapped = mapErrorToResponse(err);
    return c.json(mapped.body, mapped.status);
  }
};


