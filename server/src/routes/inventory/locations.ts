import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { eq } from 'drizzle-orm';

export const inventoryLocationsRouter = new Hono();

inventoryLocationsRouter.use('*', authMiddleware);

inventoryLocationsRouter.get('/', async (c) => {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const departmentId = c.req.query('department_id') || undefined;
  const rows = await db
    .select()
    .from(schema.locations)
    .where(departmentId ? eq(schema.locations.departmentId, departmentId) : undefined as any);
  return c.json(rows);
});


