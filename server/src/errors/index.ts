export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('validation_error', message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super('unauthorized', message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super('forbidden', message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details?: unknown) {
    super('not_found', message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('conflict', message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too Many Requests', details?: unknown) {
    super('rate_limit', message, 429, details);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal Server Error', details?: unknown) {
    super('internal', message, 500, details);
  }
}

export function mapErrorToResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    } as const;
  }
  // Map common Postgres error codes to domain-friendly responses
  const anyErr = err as any;
  const code = anyErr?.code as string | undefined;
  const message: string | undefined = anyErr?.message || anyErr?.error || undefined;
  // Unique violation
  if (code === '23505' || /duplicate key value/i.test(String(message))) {
    const appErr = new ConflictError('Conflict');
    return { status: appErr.status, body: { error: { code: appErr.code, message: appErr.message } } } as const;
  }
  // Foreign key violation, check violation, not null violation, invalid text representation
  if (code === '23503' || code === '23514' || code === '23502' || code === '22P02') {
    const appErr = new ValidationError('Validation failed');
    return { status: appErr.status, body: { error: { code: appErr.code, message: appErr.message } } } as const;
  }
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    const msg = anyErr?.message ? String(anyErr.message) : 'Internal Server Error';
    return { status: 500, body: { error: { code: 'internal', message: msg } } } as const;
  }
  return { status: 500, body: { error: { code: 'internal', message: 'Internal Server Error' } } } as const;
}


