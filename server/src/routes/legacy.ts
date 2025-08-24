import { Hono } from 'hono';
import api from '../api';

/**
 * legacyRouter wraps the legacy API routes defined in api.ts.
 * This preserves existing endpoints unchanged while we refactor composition.
 */
export const legacyRouter = new Hono();

legacyRouter.route('/', api);


