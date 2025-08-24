import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { setEnvContext, clearEnvContext, getDatabaseUrl } from './lib/env';
import * as schema from './schema';
import { and, asc, desc, eq, gte, gt, ilike, or, lte, isNull, sql, inArray } from 'drizzle-orm';
import { isValidEmail, isValidPhone, isValidState, isValidZip4, isValidZip5, normalizePhone, normalizeState, normalizeZip4, normalizeZip5, isValidDateStr, isValidTimeStr, isValidUrl, isValidColor, validateAreaName, isValidWeekdayMask, isValidFrequency } from './lib/validators';
import { listInventoryItems, createInventoryItem, getInventoryItem, patchInventoryItem } from './services/inventory/items';
import { postTransaction } from './services/inventory/postTransaction';
import { listTransactions } from './services/inventory/transactions';
import { getItemSummary } from './services/inventory/projections';
import { createReservation, listReservations, updateReservation } from './services/inventory/reservations';
import { computeOccurrences, upsertEventsForSeries } from './services/events/recurrence';
import { mountEventSeriesRoutes } from './routes/eventSeries';

type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

const app = new Hono<{ Bindings: Env }>();

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }
  
  await next();
  // No need to clear context - env vars are the same for all requests
  // In fact, clearing the context would cause the env vars to potentially be unset for parallel requests
});

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
const api = new Hono();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Database test route - public for testing
api.get('/db-test', async (c) => {
  try {
    // Use external DB URL if available, otherwise use local PostgreSQL database server
    // Note: In development, the port is dynamically allocated by port-manager.js
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    
    const db = await getDatabase(dbUrl);
    const isHealthy = await testDatabaseConnection();
    
    if (!isHealthy) {
      return c.json({
        error: 'Database connection is not healthy',
        timestamp: new Date().toISOString(),
      }, 500);
    }
    
    const result = await db.select().from(schema.users).limit(5);
    
    return c.json({
      message: 'Database connection successful!',
      users: result,
      connectionHealthy: isHealthy,
      usingLocalDatabase: !getDatabaseUrl(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Protected routes - require authentication
const protectedRoutes = new Hono();

protectedRoutes.use('*', authMiddleware);

protectedRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    user,
    message: 'You are authenticated!',
  });
});

// Mount the protected routes under /protected
api.route('/protected', protectedRoutes);

// Events routes (protected under /api/v1/events)
const eventsRoutes = new Hono();

eventsRoutes.use('*', authMiddleware);

// Helpers to format date/time strings
const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatTime = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

eventsRoutes.get('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const status = c.req.query('status') || undefined;
    const q = c.req.query('q') || undefined;
    const includePast = (c.req.query('includePast') || 'false') === 'true';
    const areaIdParam = c.req.query('areaId') || undefined; // comma-separated ids
    const from = c.req.query('from') || undefined;
    const to = c.req.query('to') || undefined;

    const now = new Date();
    const today = formatDate(now);
    const currentTime = formatTime(now);

    const conditions: any[] = [];

    if (!includePast) {
      conditions.push(
        or(
          and(eq(schema.events.date, today), gte(schema.events.endTime, currentTime)),
          gt(schema.events.date, today)
        )
      );
    }

    if (status) {
      conditions.push(eq(schema.events.status, status));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(schema.events.title, pattern),
          ilike(schema.events.promoter, pattern),
          ilike(schema.events.artists, pattern)
        )
      );
    }

    if (from) {
      conditions.push(gte(schema.events.date, from));
    }
    if (to) {
      conditions.push(lte(schema.events.date, to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let rows;
    if (areaIdParam) {
      const areaIds = String(areaIdParam).split(',').map((s) => s.trim()).filter(Boolean);
      if (areaIds.length === 1) {
        // Join to event_areas for single id
        const idRows = await db
          .select({ id: schema.events.id })
          .from(schema.events)
          .innerJoin(schema.eventAreas, eq(schema.eventAreas.eventId, schema.events.id))
          .where(and((whereClause as any) || and(), eq(schema.eventAreas.areaId, areaIds[0]!)) as any);
        const ids = idRows.map((r: any) => r.id);
        rows = await db
          .select()
          .from(schema.events)
          .where(ids.length > 0 ? (inArray as any)(schema.events.id, ids) : (sql`false`) )
          .orderBy(desc(schema.events.date), desc(schema.events.startTime));
      } else {
        const idRows = await db
          .select({ id: schema.events.id })
          .from(schema.events)
          .innerJoin(schema.eventAreas, eq(schema.eventAreas.eventId, schema.events.id))
          .where(and((whereClause as any) || and(), (inArray as any)(schema.eventAreas.areaId, areaIds)) as any);
        const idsSet = new Set(idRows.map((r: any) => r.id));
        const ids = Array.from(idsSet);
        rows = await db
          .select()
          .from(schema.events)
          .where(ids.length > 0 ? (inArray as any)(schema.events.id, ids) : (sql`false`) )
          .orderBy(desc(schema.events.date), desc(schema.events.startTime));
      }
    } else {
      rows = await db
        .select()
        .from(schema.events)
        .where(whereClause as any)
        .orderBy(desc(schema.events.date), desc(schema.events.startTime));
    }

    return c.json(rows);
  } catch (error) {
    console.error('List events error:', error);
    return c.json({ error: 'Failed to list events' }, 500);
  }
});

eventsRoutes.post('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const body = await c.req.json();
    const now = new Date();

    const normalize = (v: unknown) => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      }
      return v as any;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    // Prefer global crypto.randomUUID; fall back to Node's crypto.randomUUID if available
    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        // Use dynamic import to remain compatible with ESM/edge bundlers
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {
        // no-op; will generate a simple fallback if necessary
      }
    }
    if (!generatedId) {
      // Last-resort fallback (not ideal, but avoids runtime crashes)
      generatedId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const record = {
      id: generatedId,
      title,
      promoter: normalize(body.promoter),
      status: (typeof body.status === 'string' && body.status.trim()) || 'planned',
      date: (typeof body.date === 'string' && body.date.trim()) || formatDate(now),
      startTime: (typeof body.startTime === 'string' && body.startTime.trim()) || '00:00',
      endTime: (typeof body.endTime === 'string' && body.endTime.trim()) || '23:59',
      description: normalize(body.description),
      artists: normalize(body.artists),
      ticketUrl: normalize(body.ticketUrl),
      eventPageUrl: normalize(body.eventPageUrl),
      promoAssetsUrl: normalize(body.promoAssetsUrl),
    } as const;

    // Validate URLs if provided
    if (!isValidUrl(record.ticketUrl)) return c.json({ error: 'invalid ticketUrl: must be http(s) URL' }, 400);
    if (!isValidUrl(record.eventPageUrl)) return c.json({ error: 'invalid eventPageUrl: must be http(s) URL' }, 400);
    if (!isValidUrl(record.promoAssetsUrl)) return c.json({ error: 'invalid promoAssetsUrl: must be http(s) URL' }, 400);

    const inserted = await db.insert(schema.events).values(record).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create event error:', error);
    return c.json({ error: 'Failed to create event' }, 500);
  }
});

eventsRoutes.get('/:eventId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');

    const rows = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
    if (rows.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    return c.json({ error: 'Failed to get event' }, 500);
  }
});

eventsRoutes.patch('/:eventId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');
    const body = await c.req.json();

    const normalize = (v: unknown) => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      }
      return v as any;
    };

    const patch: any = {};
    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (body.promoter !== undefined) patch.promoter = normalize(body.promoter);
    if (typeof body.status === 'string') patch.status = body.status.trim();
    if (typeof body.date === 'string') patch.date = body.date.trim();
    if (typeof body.startTime === 'string') patch.startTime = body.startTime.trim();
    if (typeof body.endTime === 'string') patch.endTime = body.endTime.trim();
    if (body.description !== undefined) patch.description = normalize(body.description);
    if (body.artists !== undefined) patch.artists = normalize(body.artists);
    if ('ticketUrl' in body) patch.ticketUrl = normalize(body.ticketUrl);
    if ('eventPageUrl' in body) patch.eventPageUrl = normalize(body.eventPageUrl);
    if ('promoAssetsUrl' in body) patch.promoAssetsUrl = normalize(body.promoAssetsUrl);
    patch.updatedAt = new Date();

    // Validate URLs on patch if present
    if ('ticketUrl' in patch && !isValidUrl(patch.ticketUrl)) return c.json({ error: 'invalid ticketUrl: must be http(s) URL' }, 400);
    if ('eventPageUrl' in patch && !isValidUrl(patch.eventPageUrl)) return c.json({ error: 'invalid eventPageUrl: must be http(s) URL' }, 400);
    if ('promoAssetsUrl' in patch && !isValidUrl(patch.promoAssetsUrl)) return c.json({ error: 'invalid promoAssetsUrl: must be http(s) URL' }, 400);

    const updated = await db
      .update(schema.events)
      .set(patch)
      .where(eq(schema.events.id, eventId))
      .returning();

    if (updated.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }

    return c.json(updated[0]);
  } catch (error) {
    console.error('Update event error:', error);
    return c.json({ error: 'Failed to update event' }, 500);
  }
});

eventsRoutes.delete('/:eventId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');

    // Delete shifts associated with this event first (assignments cascade on shift delete)
    await db.delete(schema.shifts).where(eq(schema.shifts.eventId, eventId));

    // Then delete the event itself
    const deleted = await db.delete(schema.events).where(eq(schema.events.id, eventId)).returning();
    if (deleted.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete event error:', error);
    return c.json({ error: 'Failed to delete event' }, 500);
  }
});

eventsRoutes.get('/:eventId/shifts', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');

    const rows = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.eventId, eventId))
      .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));

    return c.json(rows);
  } catch (error) {
    console.error('List event shifts error:', error);
    return c.json({ error: 'Failed to list shifts' }, 500);
  }
});

api.route('/events', eventsRoutes);

// Areas routes (protected under /api/v1/areas)
const areasRoutes = new Hono();
areasRoutes.use('*', authMiddleware);

// Reorder areas: PATCH /areas/order { ids: string[] }
areasRoutes.patch('/order', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const body = await c.req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    if (ids.length === 0) return c.json({ error: 'ids required' }, 400);

    // Validate all exist
    const existing = await db.select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, ids));
    const existsSet = new Set(existing.map((r: any) => r.id));
    const missing = ids.filter((id) => !existsSet.has(id));
    if (missing.length > 0) return c.json({ error: 'Unknown ids', details: missing }, 400);

    // Apply order
    for (let i = 0; i < ids.length; i++) {
      await db.update(schema.areas).set({ sortOrder: i, updatedAt: new Date() }).where(eq(schema.areas.id, ids[i]!));
    }
    const rows = await db.select().from(schema.areas).orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
    return c.json(rows);
  } catch (error) {
    console.error('Reorder areas error:', error);
    return c.json({ error: 'Failed to reorder areas' }, 500);
  }
});

// GET /areas
areasRoutes.get('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const q = c.req.query('q') || undefined;
    const activeParam = c.req.query('active');
    const conditions: any[] = [];
    if (q) conditions.push(ilike(schema.areas.name, `%${q}%`));
    if (activeParam != null) conditions.push(eq(schema.areas.active, activeParam === 'true'));

    const rows = await db
      .select()
      .from(schema.areas)
      .where(conditions.length > 0 ? and(...conditions) : undefined as any)
      .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
    return c.json(rows);
  } catch (error) {
    console.error('List areas error:', error);
    return c.json({ error: 'Failed to list areas' }, 500);
  }
});

// POST /areas
areasRoutes.post('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const body = await c.req.json();

    const nameRaw = typeof body.name === 'string' ? body.name : '';
    if (!validateAreaName(nameRaw)) return c.json({ error: 'invalid name' }, 400);
    const name = nameRaw.trim();
    const description = (typeof body.description === 'string' ? body.description.trim() : '') || null;
    const color = (typeof body.color === 'string' ? body.color.trim() : '') || null;
    const active = body.active == null ? true : Boolean(body.active);
    if (!isValidColor(color)) return c.json({ error: 'invalid color' }, 400);

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
    }
    if (!generatedId) generatedId = `area_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

    try {
      const inserted = await db.insert(schema.areas).values({ id: generatedId, name, description, color, active }).returning();
      return c.json(inserted[0], 201);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('areas_name_unique')) return c.json({ error: 'Name must be unique' }, 409);
      throw e;
    }
  } catch (error) {
    console.error('Create area error:', error);
    return c.json({ error: 'Failed to create area' }, 500);
  }
});

// PATCH /areas/:areaId
areasRoutes.patch('/:areaId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const areaId = c.req.param('areaId');
    const body = await c.req.json();

    const patch: any = {};
    if (typeof body.name === 'string') {
      if (!validateAreaName(body.name)) return c.json({ error: 'invalid name' }, 400);
      patch.name = body.name.trim();
    }
    if ('description' in body) patch.description = (typeof body.description === 'string' ? body.description.trim() : null);
    if ('color' in body) {
      const color = (typeof body.color === 'string' ? body.color.trim() : '');
      if (!isValidColor(color)) return c.json({ error: 'invalid color' }, 400);
      patch.color = color || null;
    }
    if ('active' in body) patch.active = Boolean(body.active);
    patch.updatedAt = new Date();

    try {
      const updated = await db.update(schema.areas).set(patch).where(eq(schema.areas.id, areaId)).returning();
      if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
      return c.json(updated[0]);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('areas_name_unique')) return c.json({ error: 'Name must be unique' }, 409);
      throw e;
    }
  } catch (error) {
    console.error('Patch area error:', error);
    return c.json({ error: 'Failed to update area' }, 500);
  }
});

// DELETE /areas/:areaId
areasRoutes.delete('/:areaId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const areaId = c.req.param('areaId');
    try {
      await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
      return c.body(null, 204);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('event_areas_area_fk') || msg.includes('delete restrict')) {
        return c.json({ error: 'AreaInUse' }, 409);
      }
      throw e;
    }
  } catch (error) {
    console.error('Delete area error:', error);
    return c.json({ error: 'Failed to delete area' }, 500);
  }
});

// Note: mount moved to below, after defining reorder route

// Event-Areas nested routes under /events/:eventId/areas
const eventAreasRoutes = new Hono();
eventAreasRoutes.use('*', authMiddleware);

// GET /events/:eventId/areas
eventAreasRoutes.get('/:eventId/areas', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');
    const rows = await db
      .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
      .from(schema.eventAreas)
      .innerJoin(schema.areas, eq(schema.eventAreas.areaId, schema.areas.id))
      .where(eq(schema.eventAreas.eventId, eventId))
      .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
    return c.json(rows);
  } catch (error) {
    console.error('List event areas error:', error);
    return c.json({ error: 'Failed to list event areas' }, 500);
  }
});

// PUT /events/:eventId/areas { areaIds: string[] }
eventAreasRoutes.put('/:eventId/areas', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId: string = String(c.req.param('eventId'));
    const body = await c.req.json();
    const incomingIds: string[] = Array.isArray(body.areaIds)
      ? Array.from(new Set((body.areaIds as unknown[]).map((s) => String(s ?? '').trim()).filter((s) => Boolean(s)))) as string[]
      : [];

    // Verify all exist
    if (incomingIds.length > 0) {
      const existing = await db.select({ id: schema.areas.id }).from(schema.areas).where((inArray as any)(schema.areas.id, incomingIds));
      const existingIds = new Set(existing.map((r: any) => r.id));
      const missing: string[] = incomingIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) return c.json({ error: 'Unknown areaIds', details: missing }, 400);
    }

    const current = await db.select({ areaId: schema.eventAreas.areaId }).from(schema.eventAreas).where(eq(schema.eventAreas.eventId, eventId));
    const currentIds: Set<string> = new Set(current.map((r: any) => String(r.areaId)));

    const toAdd: string[] = incomingIds.filter((id) => !currentIds.has(id));
    const currentIdList: string[] = Array.from(currentIds);
    const toRemove: string[] = currentIdList.filter((id) => !incomingIds.includes(id));

    if (toRemove.length > 0) {
      await db.delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), (inArray as any)(schema.eventAreas.areaId, toRemove)));
    }
    for (const areaId of toAdd) {
      await db.insert(schema.eventAreas).values({ eventId, areaId });
    }

    // Return updated list
    const rows = await db
      .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
      .from(schema.eventAreas)
      .innerJoin(schema.areas, eq(schema.eventAreas.areaId, schema.areas.id))
      .where(eq(schema.eventAreas.eventId, eventId))
      .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));
    return c.json(rows);
  } catch (error) {
    console.error('Replace event areas error:', error);
    return c.json({ error: 'Failed to replace event areas' }, 500);
  }
});

// POST /events/:eventId/areas { areaId }
eventAreasRoutes.post('/:eventId/areas', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');
    const body = await c.req.json();
    const areaId = String(body.areaId || '').trim();
    if (!areaId) return c.json({ error: 'areaId required' }, 400);
    const exists = await db.select({ id: schema.areas.id }).from(schema.areas).where(eq(schema.areas.id, areaId)).limit(1);
    if (exists.length === 0) return c.json({ error: 'Area not found' }, 404);

    // Idempotent insert
    const already = await db.select().from(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), eq(schema.eventAreas.areaId, areaId))).limit(1);
    if (already.length === 0) {
      await db.insert(schema.eventAreas).values({ eventId, areaId });
    }
    const rows = await db
      .select({ id: schema.areas.id, name: schema.areas.name, description: schema.areas.description, color: schema.areas.color, active: schema.areas.active, updatedAt: schema.areas.updatedAt })
      .from(schema.eventAreas)
      .innerJoin(schema.areas, eq(schema.eventAreas.areaId, schema.areas.id))
      .where(eq(schema.eventAreas.eventId, eventId))
      .orderBy(asc(schema.areas.sortOrder), asc(schema.areas.name));

// (reorder route moved below, outside of nested handlers)
    return c.json(rows, 201);
  } catch (error) {
    console.error('Add event area error:', error);
    return c.json({ error: 'Failed to add event area' }, 500);
  }
});

// DELETE /events/:eventId/areas/:areaId
eventAreasRoutes.delete('/:eventId/areas/:areaId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const eventId = c.req.param('eventId');
    const areaId = c.req.param('areaId');
    await db.delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, eventId), eq(schema.eventAreas.areaId, areaId)));
    return c.body(null, 204);
  } catch (error) {
    console.error('Remove event area error:', error);
    return c.json({ error: 'Failed to remove event area' }, 500);
  }
});

// Mount nested under /events
api.route('/events', eventAreasRoutes);

// (order route defined above to avoid capture by :areaId)

// Now that all area routes (including /order) are defined, mount them
api.route('/areas', areasRoutes);

// Mount extracted event-series routes
mountEventSeriesRoutes(api);

// Departments routes (protected under /api/v1/departments)
const departmentsRoutes = new Hono();

departmentsRoutes.use('*', authMiddleware);

departmentsRoutes.get('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const q = c.req.query('q') || undefined;

    const conditions: any[] = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(schema.departments.name, pattern),
          ilike(schema.departments.description, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(schema.departments)
      .where(whereClause as any)
      .orderBy(asc(schema.departments.name));

    return c.json(rows);
  } catch (error) {
    console.error('List departments error:', error);
    return c.json({ error: 'Failed to list departments' }, 500);
  }
});

departmentsRoutes.post('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const body = await c.req.json();

    const normalize = (v: unknown) => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      }
      return v as any;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {
        // no-op
      }
    }
    if (!generatedId) {
      generatedId = `dept_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const record = {
      id: generatedId,
      name,
      description: normalize(body.description),
    } as const;

    const inserted = await db.insert(schema.departments).values(record).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create department error:', error);
    return c.json({ error: 'Failed to create department' }, 500);
  }
});

departmentsRoutes.get('/:departmentId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');

    const rows = await db.select().from(schema.departments).where(eq(schema.departments.id, departmentId)).limit(1);
    if (rows.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get department error:', error);
    return c.json({ error: 'Failed to get department' }, 500);
  }
});

departmentsRoutes.patch('/:departmentId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const body = await c.req.json();

    const normalize = (v: unknown) => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      }
      return v as any;
    };

    const patch: any = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = normalize(body.description);
    patch.updatedAt = new Date();

    const updated = await db
      .update(schema.departments)
      .set(patch)
      .where(eq(schema.departments.id, departmentId))
      .returning();

    if (updated.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }

    return c.json(updated[0]);
  } catch (error) {
    console.error('Update department error:', error);
    return c.json({ error: 'Failed to update department' }, 500);
  }
});

// (mounted after all department routes are defined, including nested employees routes below)

// Eligibility: list employees eligible for a given position within a department
departmentsRoutes.get('/:departmentId/positions/:positionId/eligible', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const positionId = c.req.param('positionId');

    // join employee_positions -> employees; filter by dept and position
    const rows = await db
      .select({
        id: schema.employees.id,
        name: schema.employees.name,
        priority: schema.employeePositions.priority,
      })
      .from(schema.employeePositions)
      .innerJoin(
        schema.employees,
        and(
          eq(schema.employees.id, schema.employeePositions.employeeId),
          eq(schema.employees.departmentId, departmentId)
        )
      )
      .where(
        and(
          eq(schema.employeePositions.departmentId, departmentId),
          eq(schema.employeePositions.positionId, positionId)
        )
      );

    const sorted = rows.slice().sort((a: any, b: any) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)) || a.name.localeCompare(b.name));
    return c.json(sorted);
  } catch (error) {
    console.error('Eligible employees error:', error);
    return c.json({ error: 'Failed to list eligible employees' }, 500);
  }
});

// Employees routes (standalone under /employees for item-level ops)
const employeesRoutes = new Hono();
employeesRoutes.use('*', authMiddleware);

// List employees by department
departmentsRoutes.get('/:departmentId/employees', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');

    const rows = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.departmentId, departmentId));

    const withFullName = rows.map((e: any) => ({
      ...e,
      fullName: `${String(e.firstName ?? '').trim()}${e.firstName && e.lastName ? ' ' : ''}${String(e.lastName ?? '').trim()}`.trim() || e.name,
    }));

    return c.json(withFullName);
  } catch (error) {
    console.error('List employees error:', error);
    return c.json({ error: 'Failed to list employees' }, 500);
  }
});

// Create employee in department
departmentsRoutes.post('/:departmentId/employees', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const body = await c.req.json();

    const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));

    // Validation
    if (!((typeof body.name === 'string' && body.name.trim()) || ((typeof body.firstName === 'string' && body.firstName.trim()) && (typeof body.lastName === 'string' && body.lastName.trim())))) {
      return c.json({ error: 'Name or firstName+lastName is required' }, 400);
    }
    if (!isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
    if (!isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
    if (!isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);
    if (!isValidZip4(body.postalCode4)) return c.json({ error: 'postalCode4 must be 4 digits' }, 400);
    if (!isValidPhone(body.primaryPhone)) return c.json({ error: 'primaryPhone must be at least 7 digits' }, 400);
    if (!isValidPhone(body.emergencyContactPhone)) return c.json({ error: 'emergencyContactPhone must be at least 7 digits' }, 400);
    if (String(body.emergencyContactPhone ?? '').trim() && !String(body.emergencyContactName ?? '').trim()) return c.json({ error: 'emergencyContactName required when emergencyContactPhone provided' }, 400);

    // ID generation
    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {
        // noop
      }
    }
    if (!generatedId) {
      generatedId = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const composedName = (String(body.name || '')).trim() || `${String(body.firstName || '').trim()} ${String(body.lastName || '').trim()}`.trim();

    const record = {
      id: generatedId,
      departmentId,
      name: composedName,
      priority: (typeof body.priority === 'number' ? body.priority : null),
      firstName: f(body.firstName),
      middleName: f(body.middleName),
      lastName: f(body.lastName),
      address1: f(body.address1),
      address2: f(body.address2),
      city: f(body.city),
      state: normalizeState(body.state),
      postalCode: normalizeZip5(body.postalCode),
      postalCode4: normalizeZip4(body.postalCode4),
      primaryPhone: normalizePhone(body.primaryPhone),
      email: f(body.email),
      emergencyContactName: f(body.emergencyContactName),
      emergencyContactPhone: normalizePhone(body.emergencyContactPhone),
    } as const;

    const inserted = await db.insert(schema.employees).values(record).returning();
    const created = inserted[0];
    const fullName = `${String(created.firstName ?? '').trim()}${created.firstName && created.lastName ? ' ' : ''}${String(created.lastName ?? '').trim()}`.trim() || created.name;
    return c.json({ ...created, fullName });
  } catch (error) {
    console.error('Create employee error:', error);
    return c.json({ error: 'Failed to create employee' }, 500);
  }
});

// Update employee
employeesRoutes.patch('/:employeeId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const employeeId = c.req.param('employeeId');
    const body = await c.req.json();

    // Partial validations
    if ('email' in body && !isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
    if ('state' in body && !isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
    if ('postalCode' in body && !isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);
    if ('postalCode4' in body && !isValidZip4(body.postalCode4)) return c.json({ error: 'postalCode4 must be 4 digits' }, 400);
    if ('primaryPhone' in body && !isValidPhone(body.primaryPhone)) return c.json({ error: 'primaryPhone must be at least 7 digits' }, 400);
    if ('emergencyContactPhone' in body && !isValidPhone(body.emergencyContactPhone)) return c.json({ error: 'emergencyContactPhone must be at least 7 digits' }, 400);
    if ('emergencyContactPhone' in body && String(body.emergencyContactPhone ?? '').trim() && !String(body.emergencyContactName ?? '').trim()) return c.json({ error: 'emergencyContactName required when emergencyContactPhone provided' }, 400);

    const patch: any = {};
    const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
    if ('name' in body) patch.name = f(body.name);
    if ('priority' in body) patch.priority = body.priority == null ? null : Number(body.priority);
    if ('firstName' in body) patch.firstName = f(body.firstName);
    if ('middleName' in body) patch.middleName = f(body.middleName);
    if ('lastName' in body) patch.lastName = f(body.lastName);
    if ('address1' in body) patch.address1 = f(body.address1);
    if ('address2' in body) patch.address2 = f(body.address2);
    if ('city' in body) patch.city = f(body.city);
    if ('state' in body) patch.state = body.state == null ? null : normalizeState(body.state);
    if ('postalCode' in body) patch.postalCode = body.postalCode == null ? null : normalizeZip5(body.postalCode);
    if ('postalCode4' in body) patch.postalCode4 = body.postalCode4 == null ? null : normalizeZip4(body.postalCode4);
    if ('primaryPhone' in body) patch.primaryPhone = body.primaryPhone == null ? null : normalizePhone(body.primaryPhone);
    if ('email' in body) patch.email = f(body.email);
    if ('emergencyContactName' in body) patch.emergencyContactName = f(body.emergencyContactName);
    if ('emergencyContactPhone' in body) patch.emergencyContactPhone = body.emergencyContactPhone == null ? null : normalizePhone(body.emergencyContactPhone);
    patch.updatedAt = new Date();

    if (("firstName" in body || "lastName" in body) && !("name" in body)) {
      const current = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).limit(1);
      const cur = current[0];
      const nextFirst = ('firstName' in body ? (body.firstName ?? cur?.firstName ?? '') : (cur?.firstName ?? '')) as string;
      const nextLast = ('lastName' in body ? (body.lastName ?? cur?.lastName ?? '') : (cur?.lastName ?? '')) as string;
      const composed = `${String(nextFirst||'').trim()} ${String(nextLast||'').trim()}`.trim();
      if (composed) patch.name = composed;
    }

    const updated = await db
      .update(schema.employees)
      .set(patch)
      .where(eq(schema.employees.id, employeeId))
      .returning();

    if (updated.length === 0) {
      return c.json({ error: 'Not found' }, 404);
    }

    const rec = updated[0];
    const fullName = `${String(rec.firstName ?? '').trim()}${rec.firstName && rec.lastName ? ' ' : ''}${String(rec.lastName ?? '').trim()}`.trim() || rec.name;
    return c.json({ ...rec, fullName });
  } catch (error) {
    console.error('Update employee error:', error);
    return c.json({ error: 'Failed to update employee' }, 500);
  }
});

// Delete employee
employeesRoutes.delete('/:employeeId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const employeeId = c.req.param('employeeId');

    await db.delete(schema.employees).where(eq(schema.employees.id, employeeId));
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete employee error:', error);
    return c.json({ error: 'Failed to delete employee' }, 500);
  }
});

api.route('/employees', employeesRoutes);
// Positions scoped under departments
departmentsRoutes.get('/:departmentId/positions', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');

    const q = c.req.query('q') || undefined;
    const conditions: any[] = [eq(schema.positions.departmentId, departmentId)];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(ilike(schema.positions.name, pattern));
    }

    const rows = await db
      .select()
      .from(schema.positions)
      .where(and(...conditions))
      .orderBy(asc(schema.positions.name));

    return c.json(rows);
  } catch (error) {
    console.error('List positions error:', error);
    return c.json({ error: 'Failed to list positions' }, 500);
  }
});

departmentsRoutes.post('/:departmentId/positions', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const body = await c.req.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {}
    }
    if (!generatedId) {
      generatedId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const record = {
      id: generatedId,
      departmentId,
      name,
    } as const;

    const inserted = await db.insert(schema.positions).values(record).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create position error:', error);
    return c.json({ error: 'Failed to create position' }, 500);
  }
});

// Employee-positions list scoped under departments
departmentsRoutes.get('/:departmentId/employee-positions', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');

    const rows = await db
      .select()
      .from(schema.employeePositions)
      .where(eq(schema.employeePositions.departmentId, departmentId));

    return c.json(rows);
  } catch (error) {
    console.error('List employee-positions error:', error);
    return c.json({ error: 'Failed to list employee positions' }, 500);
  }
});

// Finally mount departments (after nested routes above are attached)
// NOTE: Mount is moved to after scheduling routes to ensure late-added routes (e.g., shifts/assignments) are included.

// Positions item-level routes
const positionsRoutes = new Hono();
positionsRoutes.use('*', authMiddleware);

positionsRoutes.patch('/:positionId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const positionId = c.req.param('positionId');
    const body = await c.req.json();

    const patch: any = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    patch.updatedAt = new Date();

    const updated = await db
      .update(schema.positions)
      .set(patch)
      .where(eq(schema.positions.id, positionId))
      .returning();

    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update position error:', error);
    return c.json({ error: 'Failed to update position' }, 500);
  }
});

positionsRoutes.delete('/:positionId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const positionId = c.req.param('positionId');

    await db.delete(schema.positions).where(eq(schema.positions.id, positionId));
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete position error:', error);
    return c.json({ error: 'Failed to delete position' }, 500);
  }
});

api.route('/positions', positionsRoutes);

// EmployeePositions item-level routes
const employeePositionsRoutes = new Hono();
employeePositionsRoutes.use('*', authMiddleware);

employeePositionsRoutes.post('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const body = await c.req.json();

    const departmentId = String(body.departmentId || '').trim();
    const employeeId = String(body.employeeId || '').trim();
    const positionId = String(body.positionId || '').trim();
    if (!departmentId || !employeeId || !positionId) {
      return c.json({ error: 'departmentId, employeeId, and positionId are required' }, 400);
    }

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {}
    }
    if (!generatedId) {
      generatedId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const record = {
      id: generatedId,
      departmentId,
      employeeId,
      positionId,
      priority: body.priority == null ? null : Number(body.priority),
      isLead: Boolean(body.isLead),
    } as const;

    const inserted = await db.insert(schema.employeePositions).values(record).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create employee-position error:', error);
    return c.json({ error: 'Failed to create employee-position' }, 500);
  }
});

employeePositionsRoutes.patch('/:id', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('id');
    const body = await c.req.json();

    const patch: any = {};
    if ('priority' in body) patch.priority = body.priority == null ? null : Number(body.priority);
    if ('isLead' in body) patch.isLead = Boolean(body.isLead);
    patch.updatedAt = new Date();

    const updated = await db
      .update(schema.employeePositions)
      .set(patch)
      .where(eq(schema.employeePositions.id, id))
      .returning();

    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update employee-position error:', error);
    return c.json({ error: 'Failed to update employee-position' }, 500);
  }
});

employeePositionsRoutes.delete('/:id', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('id');

    await db.delete(schema.employeePositions).where(eq(schema.employeePositions.id, id));
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete employee-position error:', error);
    return c.json({ error: 'Failed to delete employee-position' }, 500);
  }
});

api.route('/employee-positions', employeePositionsRoutes);

// Batch update priorities for a single position
positionsRoutes.patch('/:positionId/employee-positions', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const positionId = c.req.param('positionId');
    const body = await c.req.json();

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return c.json({ error: 'items required' }, 400);

    // Validate all items belong to the same positionId
    const ids = items.map((i: any) => String(i.id || ''));
    const rows = await db.select().from(schema.employeePositions).where((inArray as any)(schema.employeePositions.id, ids));
    const invalid = rows.some((r: any) => r.positionId !== positionId);
    if (invalid) return c.json({ error: 'Items must belong to the position' }, 400);

    // Apply updates
    const updated: any[] = [];
    for (const item of items) {
      const patch: any = { priority: Number(item.priority) };
      if ('isLead' in item) patch.isLead = Boolean(item.isLead);
      patch.updatedAt = new Date();
      const res = await db.update(schema.employeePositions).set(patch).where(eq(schema.employeePositions.id, item.id)).returning();
      if (res[0]) updated.push(res[0]);
    }

    return c.json(updated);
  } catch (error) {
    console.error('Batch update employee-positions error:', error);
    return c.json({ error: 'Failed to update employee-positions' }, 500);
  }
});

// Mount the API router (moved to end of file after all routes are attached)

// -------------------- Scheduling: Schedules, Shifts, Assignments --------------------

// Schedules
const schedulesRoutes = new Hono();
schedulesRoutes.use('*', authMiddleware);

schedulesRoutes.get('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const q = c.req.query('q') || undefined;
    const isPublishedParam = c.req.query('isPublished');
    const from = c.req.query('from') || undefined;
    const to = c.req.query('to') || undefined;

    const conditions: any[] = [];
    if (q) conditions.push(ilike(schema.schedules.name, `%${q}%`));
    if (isPublishedParam != null) conditions.push(eq(schema.schedules.isPublished, isPublishedParam === 'true'));
    if (from && isValidDateStr(from)) {
      conditions.push(gte(schema.schedules.endDate, from));
    }
    if (to && isValidDateStr(to)) {
      conditions.push(lte(schema.schedules.startDate, to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(schema.schedules)
      .where(whereClause as any)
      .orderBy(desc(schema.schedules.createdAt));
    return c.json(rows);
  } catch (error) {
    console.error('List schedules error:', error);
    return c.json({ error: 'Failed to list schedules' }, 500);
  }
});

schedulesRoutes.post('/', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const body = await c.req.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';
    if (!name) return c.json({ error: 'name required' }, 400);
    if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) return c.json({ error: 'invalid date format YYYY-MM-DD' }, 400);
    if (startDate > endDate) return c.json({ error: 'startDate must be <= endDate' }, 400);

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
    }
    if (!generatedId) generatedId = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const inserted = await db.insert(schema.schedules).values({ id: generatedId, name, startDate, endDate }).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create schedule error:', error);
    return c.json({ error: 'Failed to create schedule' }, 500);
  }
});

schedulesRoutes.get('/:scheduleId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('scheduleId');
    const rows = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id)).limit(1);
    if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get schedule error:', error);
    return c.json({ error: 'Failed to get schedule' }, 500);
  }
});

schedulesRoutes.patch('/:scheduleId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('scheduleId');
    const body = await c.req.json();
    const patch: any = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.startDate === 'string') {
      if (!isValidDateStr(body.startDate)) return c.json({ error: 'invalid startDate' }, 400);
      patch.startDate = body.startDate.trim();
    }
    if (typeof body.endDate === 'string') {
      if (!isValidDateStr(body.endDate)) return c.json({ error: 'invalid endDate' }, 400);
      patch.endDate = body.endDate.trim();
    }
    if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) return c.json({ error: 'startDate must be <= endDate' }, 400);
    patch.updatedAt = new Date();
    const updated = await db.update(schema.schedules).set(patch).where(eq(schema.schedules.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update schedule error:', error);
    return c.json({ error: 'Failed to update schedule' }, 500);
  }
});

schedulesRoutes.post('/:scheduleId/publish', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('scheduleId');
    const updated = await db.update(schema.schedules).set({ isPublished: true, publishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.schedules.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Publish schedule error:', error);
    return c.json({ error: 'Failed to publish schedule' }, 500);
  }
});

schedulesRoutes.post('/:scheduleId/unpublish', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('scheduleId');
    const updated = await db.update(schema.schedules).set({ isPublished: false, publishedAt: null, updatedAt: new Date() }).where(eq(schema.schedules.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Unpublish schedule error:', error);
    return c.json({ error: 'Failed to unpublish schedule' }, 500);
  }
});

// Generate shifts for a schedule from events within schedule window
schedulesRoutes.post('/:scheduleId/generate-shifts', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const scheduleId = c.req.param('scheduleId');
    const body = await c.req.json();
    const departmentId = String(body.departmentId || '').trim();
    const regenerate = Boolean(body.regenerate);

    if (!departmentId) return c.json({ error: 'departmentId required' }, 400);

    // Load schedule and validate dates
    const schedulesRows = await db.select().from(schema.schedules).where(eq(schema.schedules.id, scheduleId)).limit(1);
    const schedule = schedulesRows[0];
    if (!schedule) return c.json({ error: 'Schedule not found' }, 404);
    if (!isValidDateStr(schedule.startDate) || !isValidDateStr(schedule.endDate)) {
      return c.json({ error: 'Schedule has invalid dates' }, 400);
    }
    if (String(schedule.startDate) > String(schedule.endDate)) {
      return c.json({ error: 'Schedule startDate must be <= endDate' }, 400);
    }

    if (regenerate) {
      if (schedule.isPublished) return c.json({ error: 'Cannot regenerate a published schedule. Unpublish first.' }, 409);
      // Delete Assignments for dept+schedule shifts, then delete those shifts
      // Find shift ids first
      const existingShifts = await db
        .select({ id: schema.shifts.id })
        .from(schema.shifts)
        .where(and(eq(schema.shifts.scheduleId, scheduleId), eq(schema.shifts.departmentId, departmentId)));

      const shiftIds = existingShifts.map((s: any) => s.id);
      if (shiftIds.length > 0) {
        // Delete assignments referencing these shifts
        await db.delete(schema.assignments).where((inArray as any)(schema.assignments.shiftId, shiftIds));
        // Delete shifts
        await db.delete(schema.shifts).where((inArray as any)(schema.shifts.id, shiftIds));
      }
    }

    // Pull events in schedule window (inclusive)
    const eventsInRange = await db
      .select()
      .from(schema.events)
      .where(and(
        gte(schema.events.date, String(schedule.startDate)),
        lte(schema.events.date, String(schedule.endDate))
      ))
      .orderBy(asc(schema.events.date), asc(schema.events.startTime));

    let created = 0;
    let skipped = 0;
    const createdShifts: any[] = [];

    for (const evt of eventsInRange as any[]) {
      // If not regenerating, avoid duplicates for same (scheduleId, eventId, departmentId)
      if (!regenerate) {
        const exists = await db
          .select({ id: schema.shifts.id })
          .from(schema.shifts)
          .where(and(
            eq(schema.shifts.scheduleId, scheduleId),
            eq(schema.shifts.departmentId, departmentId),
            eq(schema.shifts.eventId, evt.id)
          ))
          .limit(1);
        if (exists.length > 0) { skipped++; continue; }
      }

      // Generate ID
      let generatedId: string | undefined;
      const g: any = globalThis as any;
      if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
        generatedId = g.crypto.randomUUID();
      } else {
        try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
      }
      if (!generatedId) generatedId = `shf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const inserted = await db.insert(schema.shifts).values({
        id: generatedId,
        departmentId,
        scheduleId,
        eventId: evt.id,
        date: evt.date,
        startTime: evt.startTime,
        endTime: evt.endTime,
        title: evt.title,
      }).returning();
      if (inserted[0]) {
        created++;
        createdShifts.push(inserted[0]);
      }
    }

    return c.json({ created, skipped, shifts: createdShifts }, 201);
  } catch (error) {
    console.error('Generate shifts for schedule error:', error);
    return c.json({ error: 'Failed to generate shifts' }, 500);
  }
});

api.route('/schedules', schedulesRoutes);

// Shifts (scoped under departments and item-level routes)
departmentsRoutes.get('/:departmentId/shifts', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const q = c.req.query('q') || undefined;
    const scheduleId = c.req.query('scheduleId') || undefined;
    const from = c.req.query('from') || undefined;
    const to = c.req.query('to') || undefined;
    const publishedParam = c.req.query('published');

    const conditions: any[] = [eq(schema.shifts.departmentId, departmentId)];
    if (q) conditions.push(or(ilike(schema.shifts.title, `%${q}%`), ilike(schema.shifts.notes, `%${q}%`)));
    if (scheduleId) conditions.push(eq(schema.shifts.scheduleId, scheduleId));
    if (from && isValidDateStr(from)) conditions.push(gte(schema.shifts.date, from));
    if (to && isValidDateStr(to)) conditions.push(lte(schema.shifts.date, to));

    const whereClause = and(...conditions);

    // Left join schedules to compute derived published and filter if requested
    const rows = await db
      .select({
        id: schema.shifts.id,
        departmentId: schema.shifts.departmentId,
        scheduleId: schema.shifts.scheduleId,
        date: schema.shifts.date,
        startTime: schema.shifts.startTime,
        endTime: schema.shifts.endTime,
        title: schema.shifts.title,
        notes: schema.shifts.notes,
        eventId: schema.shifts.eventId,
        updatedAt: schema.shifts.updatedAt,
        schedulePublished: schema.schedules.isPublished,
      })
      .from(schema.shifts)
      .leftJoin(schema.schedules, eq(schema.shifts.scheduleId, schema.schedules.id))
      .where(whereClause as any)
      .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));

    const mapped = rows.map((r: any) => ({
      ...r,
      derivedPublished: Boolean(r.scheduleId && r.schedulePublished),
    }));

    if (publishedParam != null) {
      const want = publishedParam === 'true';
      const filtered = mapped.filter((m: any) => m.derivedPublished === want);
      return c.json(filtered);
    }

    return c.json(mapped);
  } catch (error) {
    console.error('List shifts error:', error);
    return c.json({ error: 'Failed to list shifts' }, 500);
  }
});

departmentsRoutes.post('/:departmentId/shifts', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const body = await c.req.json();
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';
    const endTime = typeof body.endTime === 'string' ? body.endTime.trim() : '';
    if (!isValidDateStr(date)) return c.json({ error: 'invalid date' }, 400);
    if (!isValidTimeStr(startTime) || !isValidTimeStr(endTime)) return c.json({ error: 'invalid time HH:mm' }, 400);
    if (!(startTime < endTime)) return c.json({ error: 'startTime must be < endTime' }, 400);

    const title = typeof body.title === 'string' ? (body.title.trim() || null) : null;
    const notes = typeof body.notes === 'string' ? (body.notes.trim() || null) : null;
    const scheduleId = typeof body.scheduleId === 'string' && body.scheduleId.trim() ? body.scheduleId.trim() : null;
    const eventId = typeof body.eventId === 'string' && body.eventId.trim() ? body.eventId.trim() : null;

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
    }
    if (!generatedId) generatedId = `shf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const inserted = await db.insert(schema.shifts).values({
      id: generatedId,
      departmentId,
      scheduleId: scheduleId as any,
      date,
      startTime,
      endTime,
      title,
      notes,
      eventId: eventId as any,
    }).returning();
    const created = inserted[0];

    // Overlap warnings
    const overlaps = await db
      .select({ id: schema.shifts.id, start: schema.shifts.startTime, end: schema.shifts.endTime, title: schema.shifts.title })
      .from(schema.shifts)
      .where(and(
        eq(schema.shifts.departmentId, departmentId),
        eq(schema.shifts.date, date),
        // S.start < O.end && S.end > O.start
        sql`(${schema.shifts.startTime.name} < ${endTime}) and (${schema.shifts.endTime.name} > ${startTime}) and (${schema.shifts.id.name} <> ${created.id})`
      ));

    // Compute derivedPublished via join to schedules
    let derivedPublished = false;
    if (created.scheduleId) {
      const sched = await db
        .select({ isPublished: schema.schedules.isPublished })
        .from(schema.schedules)
        .where(eq(schema.schedules.id, created.scheduleId))
        .limit(1);
      derivedPublished = Boolean(created.scheduleId && sched[0]?.isPublished);
    }

    const warnings = overlaps.length > 0 ? overlaps.map((o: any) => `Overlaps with shift ${o.title || o.id}`) : [];
    return c.json({ ...created, derivedPublished, warnings }, 201);
  } catch (error) {
    console.error('Create shift error:', error);
    return c.json({ error: 'Failed to create shift' }, 500);
  }
});

api.get('/shifts/:shiftId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('shiftId');
    const rows = await db.select().from(schema.shifts).where(eq(schema.shifts.id, id)).limit(1);
    if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get shift error:', error);
    return c.json({ error: 'Failed to get shift' }, 500);
  }
});

api.patch('/shifts/:shiftId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('shiftId');
    const body = await c.req.json();
    const patch: any = {};
    if (typeof body.title === 'string') patch.title = body.title.trim() || null;
    if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null;
    if (typeof body.date === 'string') { if (!isValidDateStr(body.date)) return c.json({ error: 'invalid date' }, 400); patch.date = body.date.trim(); }
    if (typeof body.startTime === 'string') { if (!isValidTimeStr(body.startTime)) return c.json({ error: 'invalid time' }, 400); patch.startTime = body.startTime.trim(); }
    if (typeof body.endTime === 'string') { if (!isValidTimeStr(body.endTime)) return c.json({ error: 'invalid time' }, 400); patch.endTime = body.endTime.trim(); }
    if (('startTime' in patch) && ('endTime' in patch) && !(patch.startTime < patch.endTime)) return c.json({ error: 'startTime must be < endTime' }, 400);
    if ('scheduleId' in body) patch.scheduleId = (typeof body.scheduleId === 'string' && body.scheduleId.trim()) ? String(body.scheduleId).trim() : null;
    if ('eventId' in body) patch.eventId = (typeof body.eventId === 'string' && body.eventId.trim()) ? String(body.eventId).trim() : null;
    patch.updatedAt = new Date();
    const updated = await db.update(schema.shifts).set(patch).where(eq(schema.shifts.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update shift error:', error);
    return c.json({ error: 'Failed to update shift' }, 500);
  }
});

api.delete('/shifts/:shiftId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('shiftId');
    await db.delete(schema.shifts).where(eq(schema.shifts.id, id));
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete shift error:', error);
    return c.json({ error: 'Failed to delete shift' }, 500);
  }
});

// Optional: Cross-department shifts list
api.get('/shifts', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);

    const departmentIdParam = c.req.query('departmentId') || undefined;
    const q = c.req.query('q') || undefined;
    const scheduleId = c.req.query('scheduleId') || undefined;
    const from = c.req.query('from') || undefined;
    const to = c.req.query('to') || undefined;
    const publishedParam = c.req.query('published');

    const conditions: any[] = [];
    if (departmentIdParam) {
      const ids = String(departmentIdParam).split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 1) {
        conditions.push(eq(schema.shifts.departmentId, ids[0]!));
      } else if (ids.length > 1) {
        // Drizzle inArray helper via (schema as any)
        conditions.push((inArray as any)(schema.shifts.departmentId, ids));
      }
    }
    if (q) conditions.push(or(ilike(schema.shifts.title, `%${q}%`), ilike(schema.shifts.notes, `%${q}%`)));
    if (scheduleId) conditions.push(eq(schema.shifts.scheduleId, scheduleId));
    if (from && isValidDateStr(from)) conditions.push(gte(schema.shifts.date, from));
    if (to && isValidDateStr(to)) conditions.push(lte(schema.shifts.date, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: schema.shifts.id,
        departmentId: schema.shifts.departmentId,
        scheduleId: schema.shifts.scheduleId,
        date: schema.shifts.date,
        startTime: schema.shifts.startTime,
        endTime: schema.shifts.endTime,
        title: schema.shifts.title,
        notes: schema.shifts.notes,
        eventId: schema.shifts.eventId,
        updatedAt: schema.shifts.updatedAt,
        schedulePublished: schema.schedules.isPublished,
      })
      .from(schema.shifts)
      .leftJoin(schema.schedules, eq(schema.shifts.scheduleId, schema.schedules.id))
      .where(whereClause as any)
      .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));

    const mapped = rows.map((r: any) => ({ ...r, derivedPublished: Boolean(r.scheduleId && r.schedulePublished) }));

    if (publishedParam != null) {
      const want = publishedParam === 'true';
      const filtered = mapped.filter((m: any) => m.derivedPublished === want);
      return c.json(filtered);
    }

    return c.json(mapped);
  } catch (error) {
    console.error('List all shifts error:', error);
    return c.json({ error: 'Failed to list shifts' }, 500);
  }
});

// Assignments
departmentsRoutes.get('/:departmentId/assignments', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const shiftId = c.req.query('shiftId') || undefined;
    const conditions: any[] = [eq(schema.assignments.departmentId, departmentId)];
    if (shiftId) conditions.push(eq(schema.assignments.shiftId, shiftId));
    const rows = await db.select().from(schema.assignments).where(conditions.length > 1 ? and(...conditions) : conditions[0] as any);
    return c.json(rows);
  } catch (error) {
    console.error('List assignments error:', error);
    return c.json({ error: 'Failed to list assignments' }, 500);
  }
});

departmentsRoutes.post('/:departmentId/assignments', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const departmentId = c.req.param('departmentId');
    const body = await c.req.json();
    const shiftId = String(body.shiftId || '').trim();
    const requiredPositionId = String(body.requiredPositionId || '').trim();
    const assigneeEmployeeId = String(body.assigneeEmployeeId || '').trim() || null;
    if (!shiftId || !requiredPositionId) return c.json({ error: 'shiftId and requiredPositionId required' }, 400);

    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
    }
    if (!generatedId) generatedId = `asg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const inserted = await db.insert(schema.assignments).values({ id: generatedId, departmentId, shiftId, requiredPositionId, assigneeEmployeeId: assigneeEmployeeId as any }).returning();
    return c.json(inserted[0]);
  } catch (error) {
    console.error('Create assignment error:', error);
    return c.json({ error: 'Failed to create assignment' }, 500);
  }
});

api.patch('/assignments/:assignmentId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('assignmentId');
    const body = await c.req.json();
    const patch: any = {};
    if ('assigneeEmployeeId' in body) {
      patch.assigneeEmployeeId = (body.assigneeEmployeeId == null || String(body.assigneeEmployeeId).trim() === '') ? null : String(body.assigneeEmployeeId).trim();
    }
    patch.updatedAt = new Date();
    const updated = await db.update(schema.assignments).set(patch).where(eq(schema.assignments.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update assignment error:', error);
    return c.json({ error: 'Failed to update assignment' }, 500);
  }
});

api.delete('/assignments/:assignmentId', async (c) => {
  try {
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    const db = await getDatabase(dbUrl);
    const id = c.req.param('assignmentId');
    await db.delete(schema.assignments).where(eq(schema.assignments.id, id));
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete assignment error:', error);
    return c.json({ error: 'Failed to delete assignment' }, 500);
  }
});

// Mount departments after scheduling routes are attached
api.route('/departments', departmentsRoutes);

// -------------------- Inventory Routes (protected under /api/v1/inventory) --------------------
const inventoryRoutes = new Hono();
inventoryRoutes.use('*', authMiddleware);

// Items
inventoryRoutes.get('/schemas', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const rows = await db.select().from(schema.attributeSchema).orderBy(asc(schema.attributeSchema.itemType), desc(schema.attributeSchema.version));
    // Deduplicate by itemType keeping highest version first
    const seen = new Set<string>();
    const unique = rows.filter((r: any) => {
      if (seen.has(r.itemType)) return false;
      seen.add(r.itemType);
      return true;
    });
    return c.json(unique);
  } catch (error) {
    console.error('List inventory schemas error:', error);
    return c.json({ error: 'Failed to list schemas' }, 500);
  }
});

inventoryRoutes.get('/items', async (c) => {
  const q = c.req.query('q') || undefined;
  const itemType = c.req.query('item_type') || undefined;
  const activeParam = c.req.query('active');
  const active = activeParam == null ? undefined : activeParam === 'true';
  const rows = await listInventoryItems({ q, itemType, active });
  return c.json(rows);
});

inventoryRoutes.post('/items', async (c) => {
  try {
    const body = await c.req.json();
    const rec = await createInventoryItem({
      sku: String(body.sku || '').trim(),
      name: String(body.name || '').trim(),
      itemType: String(body.itemType || '').trim(),
      baseUnit: String(body.baseUnit || '').trim(),
      schemaId: String(body.schemaId || '').trim(),
      attributes: body.attributes ?? {},
      categoryId: body.categoryId ?? null,
    });
    return c.json(rec, 201);
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    if (typeof msg === 'string' && msg.startsWith('attributes invalid:')) {
      return c.json({ error: msg }, 400);
    }
    console.error('Create inventory item error:', error);
    return c.json({ error: 'Failed to create inventory item' }, 500);
  }
});

inventoryRoutes.get('/items/:itemId', async (c) => {
  const item = await getInventoryItem(c.req.param('itemId'));
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(item);
});

inventoryRoutes.patch('/items/:itemId', async (c) => {
  try {
    const body = await c.req.json();
    const updated = await patchInventoryItem(c.req.param('itemId'), {
      name: typeof body.name === 'string' ? body.name : undefined,
      baseUnit: typeof body.baseUnit === 'string' ? body.baseUnit : undefined,
      attributes: 'attributes' in body ? body.attributes : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(updated);
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    if (typeof msg === 'string' && msg.startsWith('attributes invalid:')) {
      return c.json({ error: msg }, 400);
    }
    console.error('Patch inventory item error:', error);
    return c.json({ error: 'Failed to patch inventory item' }, 500);
  }
});

// Transactions
inventoryRoutes.post('/transactions', async (c) => {
  const body = await c.req.json();
  const entries = await postTransaction({
    itemId: String(body.itemId || '').trim(),
    locationId: String(body.locationId || '').trim(),
    eventType: String(body.eventType || '').trim(),
    qtyBase: body.qtyBase == null ? undefined : Number(body.qtyBase),
    qty: body.qty == null ? undefined : Number(body.qty),
    unit: typeof body.unit === 'string' ? body.unit : undefined,
    lotId: body.lotId ?? null,
    serialNo: body.serialNo ?? null,
    costPerBase: body.costPerBase == null ? null : Number(body.costPerBase),
    sourceDoc: body.sourceDoc ?? null,
    postedBy: String(body.postedBy || '').trim(),
    transfer: body.transfer || null,
  });
  return c.json(entries, 201);
});

// Transactions list
inventoryRoutes.get('/transactions', async (c) => {
  const rows = await listTransactions({
    itemId: c.req.query('itemId') || undefined,
    locationId: c.req.query('locationId') || undefined,
    eventType: c.req.query('eventType') || undefined,
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    order: (c.req.query('order') as any) || 'desc',
  });
  return c.json(rows);
});

// Reservations
inventoryRoutes.post('/reservations', async (c) => {
  const body = await c.req.json();
  const res = await createReservation({
    itemId: String(body.itemId || '').trim(),
    locationId: String(body.locationId || '').trim(),
    eventId: String(body.eventId || '').trim(),
    qtyBase: Number(body.qtyBase),
    startTs: String(body.startTs || '').trim(),
    endTs: String(body.endTs || '').trim(),
  });
  return c.json(res, 201);
});

inventoryRoutes.get('/reservations', async (c) => {
  const rows = await listReservations({
    itemId: c.req.query('itemId') || undefined,
    eventId: c.req.query('eventId') || undefined,
  });
  return c.json(rows);
});

inventoryRoutes.patch('/reservations/:resId', async (c) => {
  const body = await c.req.json();
  const action = String(body.action || '').trim();
  if (!['RELEASE', 'FULFILL'].includes(action)) return c.json({ error: 'action must be RELEASE or FULFILL' }, 400);
  const updated = await updateReservation(c.req.param('resId'), action as any);
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// Locations list (basic)
inventoryRoutes.get('/locations', async (c) => {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const departmentId = c.req.query('department_id') || undefined;
  const rows = await db
    .select()
    .from(schema.locations)
    .where(departmentId ? eq(schema.locations.departmentId, departmentId) : undefined as any);
  return c.json(rows);
});

// Item summary
inventoryRoutes.get('/items/:itemId/summary', async (c) => {
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const summary = await getItemSummary(c.req.param('itemId'), { from, to });
  return c.json(summary);
});

// Mount inventory under /inventory
api.route('/inventory', inventoryRoutes);

// -------------------- Contacts Routes (protected under /api/v1/contacts) --------------------
const contactsRoutes = new Hono();
contactsRoutes.use('*', authMiddleware);

contactsRoutes.get('/', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const rows = await db
      .select()
      .from(schema.contacts)
      .orderBy(asc(schema.contacts.lastName), asc(schema.contacts.firstName));
    return c.json(rows);
  } catch (error) {
    console.error('List contacts error:', error);
    return c.json({ error: 'Failed to list contacts' }, 500);
  }
});

contactsRoutes.post('/', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const body = await c.req.json();

    const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));

    // Validations (light): email/state/zip/phone formats
    if (!isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
    if (!isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
    if (!isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);

    // ID generation
    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try {
        const nodeCrypto = await import('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          generatedId = nodeCrypto.randomUUID();
        }
      } catch {}
    }
    if (!generatedId) generatedId = `ct_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const rec = {
      id: generatedId,
      prefix: f(body.prefix),
      firstName: f(body.firstName),
      lastName: f(body.lastName),
      suffix: f(body.suffix),
      address1: f(body.address1),
      address2: f(body.address2),
      city: f(body.city),
      state: body.state == null ? null : normalizeState(body.state),
      postalCode: body.postalCode == null ? null : normalizeZip5(body.postalCode),
      email: f(body.email),
      paymentDetails: f(body.paymentDetails),
      contactNumber: body.contactNumber == null ? null : normalizePhone(body.contactNumber),
      organization: f(body.organization),
    } as const;

    const inserted = await db.insert(schema.contacts).values(rec).returning();
    return c.json(inserted[0], 201);
  } catch (error) {
    console.error('Create contact error:', error);
    return c.json({ error: 'Failed to create contact' }, 500);
  }
});

contactsRoutes.get('/:contactId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('contactId');
    const rows = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id)).limit(1);
    if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get contact error:', error);
    return c.json({ error: 'Failed to get contact' }, 500);
  }
});

contactsRoutes.patch('/:contactId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('contactId');
    const body = await c.req.json();

    if ('email' in body && !isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
    if ('state' in body && !isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
    if ('postalCode' in body && !isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);
    if ('contactNumber' in body && !isValidPhone(body.contactNumber)) return c.json({ error: 'contactNumber must be at least 7 digits' }, 400);

    const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
    const patch: any = {};
    if ('prefix' in body) patch.prefix = f(body.prefix);
    if ('firstName' in body) patch.firstName = f(body.firstName);
    if ('lastName' in body) patch.lastName = f(body.lastName);
    if ('suffix' in body) patch.suffix = f(body.suffix);
    if ('address1' in body) patch.address1 = f(body.address1);
    if ('address2' in body) patch.address2 = f(body.address2);
    if ('city' in body) patch.city = f(body.city);
    if ('state' in body) patch.state = body.state == null ? null : normalizeState(body.state);
    if ('postalCode' in body) patch.postalCode = body.postalCode == null ? null : normalizeZip5(body.postalCode);
    if ('email' in body) patch.email = f(body.email);
    if ('paymentDetails' in body) patch.paymentDetails = f(body.paymentDetails);
    if ('contactNumber' in body) patch.contactNumber = body.contactNumber == null ? null : normalizePhone(body.contactNumber);
    if ('organization' in body) patch.organization = f(body.organization);
    patch.updatedAt = new Date();

    const updated = await db.update(schema.contacts).set(patch).where(eq(schema.contacts.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(updated[0]);
  } catch (error) {
    console.error('Update contact error:', error);
    return c.json({ error: 'Failed to update contact' }, 500);
  }
});

contactsRoutes.delete('/:contactId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('contactId');
    const deleted = await db.delete(schema.contacts).where(eq(schema.contacts.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete contact error:', error);
    return c.json({ error: 'Failed to delete contact' }, 500);
  }
});

api.route('/contacts', contactsRoutes);

// -------------------- Addresses Routes (protected under /api/v1/addresses) --------------------
const addressesRoutes = new Hono();
addressesRoutes.use('*', authMiddleware);

// Helpers
const allowedAddressStatuses = ['active', 'inactive', 'pending_verification'] as const;
const isValidLatitude = (v: unknown): boolean => {
  if (v == null || String(v).trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90;
};
const isValidLongitude = (v: unknown): boolean => {
  if (v == null || String(v).trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180;
};

addressesRoutes.get('/', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const entityType = c.req.query('entityType') || undefined;
    const entityId = c.req.query('entityId') || undefined;
    const role = c.req.query('role') || undefined;
    const status = c.req.query('status') || undefined;
    const isPrimaryParam = c.req.query('isPrimary');
    const q = c.req.query('q') || undefined;

    const conditions: any[] = [];
    if (entityType) conditions.push(eq(schema.addresses.entityType, entityType));
    if (entityId) conditions.push(eq(schema.addresses.entityId, entityId));
    if (role) conditions.push(eq(schema.addresses.role, role));
    if (status) conditions.push(eq(schema.addresses.status, status));
    if (isPrimaryParam != null) conditions.push(eq(schema.addresses.isPrimary, isPrimaryParam === 'true'));
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(ilike(schema.addresses.city, pattern), ilike(schema.addresses.addressLine1, pattern)));
    }

    const rows = await db
      .select()
      .from(schema.addresses)
      .where(conditions.length > 0 ? and(...conditions) : undefined as any)
      .orderBy(desc(schema.addresses.isPrimary), desc(schema.addresses.updatedAt));
    return c.json(rows);
  } catch (error) {
    console.error('List addresses error:', error);
    return c.json({ error: 'Failed to list addresses' }, 500);
  }
});

addressesRoutes.post('/', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const body = await c.req.json();

    const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : String(v)));

    const entityType = String(body.entityType || '').trim();
    const entityId = String(body.entityId || '').trim();
    if (!entityType || !entityId) return c.json({ error: 'entityType and entityId are required' }, 400);
    if (!['contact', 'employee'].includes(entityType)) return c.json({ error: 'entityType must be contact or employee (organization not enabled yet)' }, 400);

    // Validate entity existence for supported types (organization reserved for future)
    if (entityType === 'contact') {
      const exists = await db.select({ id: schema.contacts.id }).from(schema.contacts).where(eq(schema.contacts.id, entityId)).limit(1);
      if (exists.length === 0) return c.json({ error: 'Contact not found' }, 400);
    } else if (entityType === 'employee') {
      const exists = await db.select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, entityId)).limit(1);
      if (exists.length === 0) return c.json({ error: 'Employee not found' }, 400);
    }

    // Required core fields
    const addressLine1 = String(body.addressLine1 || body.address_line_1 || '').trim();
    const city = String(body.city || '').trim();
    const state = normalizeState(body.state);
    const zipCode = normalizeZip5(body.zipCode ?? body.zip_code);
    const zipPlus4 = normalizeZip4(body.zipPlus4 ?? body.zip_plus4);

    if (!addressLine1) return c.json({ error: 'addressLine1 is required' }, 400);
    if (!city) return c.json({ error: 'city is required' }, 400);
    if (!isValidState(state) || state == null) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
    if (!(zipCode && isValidZip5(zipCode))) return c.json({ error: 'zipCode must be 5 digits' }, 400);
    if (!isValidZip4(zipPlus4)) return c.json({ error: 'zipPlus4 must be 4 digits' }, 400);

    if (!isValidLatitude(body.latitude)) return c.json({ error: 'latitude must be between -90 and 90' }, 400);
    if (!isValidLongitude(body.longitude)) return c.json({ error: 'longitude must be between -180 and 180' }, 400);

    // Validate dates ordering if both present
    const validFrom = typeof body.validFrom === 'string' ? body.validFrom.trim() : null;
    const validTo = typeof body.validTo === 'string' ? body.validTo.trim() : null;
    if (validFrom && !isValidDateStr(validFrom)) return c.json({ error: 'invalid validFrom YYYY-MM-DD' }, 400);
    if (validTo && !isValidDateStr(validTo)) return c.json({ error: 'invalid validTo YYYY-MM-DD' }, 400);
    if (validFrom && validTo && !(validFrom <= validTo)) return c.json({ error: 'validFrom must be <= validTo' }, 400);

    // ID generation
    let generatedId: string | undefined;
    const g: any = globalThis as any;
    if (typeof g !== 'undefined' && g.crypto && typeof g.crypto.randomUUID === 'function') {
      generatedId = g.crypto.randomUUID();
    } else {
      try { const nodeCrypto = await import('node:crypto'); if (typeof nodeCrypto.randomUUID === 'function') { generatedId = nodeCrypto.randomUUID(); } } catch {}
    }
    if (!generatedId) generatedId = `addr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Status validation
    const rawStatus = typeof body.status === 'string' ? body.status.trim() : '';
    const status = rawStatus || 'active';
    if (!allowedAddressStatuses.includes(status as any)) return c.json({ error: 'invalid status' }, 400);

    const record = {
      id: generatedId,
      entityType,
      entityId,
      role: s(body.role),
      validFrom: validFrom as any,
      validTo: validTo as any,
      isPrimary: Boolean(body.isPrimary),
      addressLine1,
      addressLine2: s(body.addressLine2 ?? body.address_line_2),
      city,
      county: s(body.county),
      state: String(state),
      zipCode: String(zipCode),
      zipPlus4: zipPlus4,
      latitude: body.latitude == null || String(body.latitude).trim() === '' ? null : String(Number(body.latitude)),
      longitude: body.longitude == null || String(body.longitude).trim() === '' ? null : String(Number(body.longitude)),
      uspsStandardized: s(body.uspsStandardized),
      rawInput: s(body.rawInput),
      verified: Boolean(body.verified),
      verificationDate: typeof body.verificationDate === 'string' ? body.verificationDate.trim() : null,
      dataSource: (typeof body.dataSource === 'string' && body.dataSource.trim()) || 'manual',
      status: status,
    } as const;

    try {
      const inserted = await db.insert(schema.addresses).values(record).returning();
      return c.json(inserted[0], 201);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('uniq_addresses_primary_per_role')) return c.json({ error: 'PrimaryExists' }, 409);
      throw e;
    }
  } catch (error) {
    console.error('Create address error:', error);
    return c.json({ error: 'Failed to create address' }, 500);
  }
});

addressesRoutes.get('/:addressId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('addressId');
    const rows = await db.select().from(schema.addresses).where(eq(schema.addresses.id, id)).limit(1);
    if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0]);
  } catch (error) {
    console.error('Get address error:', error);
    return c.json({ error: 'Failed to get address' }, 500);
  }
});

addressesRoutes.patch('/:addressId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('addressId');
    const body = await c.req.json();

    const patch: any = {};
    const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : String(v)));

    if ('entityType' in body) {
      const entityType = String(body.entityType || '').trim();
      if (!['contact', 'employee'].includes(entityType)) return c.json({ error: 'entityType must be contact or employee (organization not enabled yet)' }, 400);
      patch.entityType = entityType;
    }
    if ('entityId' in body) patch.entityId = String(body.entityId || '').trim();
    if ('role' in body) patch.role = s(body.role);
    if ('validFrom' in body) {
      if (body.validFrom != null && !isValidDateStr(body.validFrom)) return c.json({ error: 'invalid validFrom' }, 400);
      patch.validFrom = body.validFrom == null ? null : String(body.validFrom).trim();
    }
    if ('validTo' in body) {
      if (body.validTo != null && !isValidDateStr(body.validTo)) return c.json({ error: 'invalid validTo' }, 400);
      patch.validTo = body.validTo == null ? null : String(body.validTo).trim();
    }
    if ('isPrimary' in body) patch.isPrimary = Boolean(body.isPrimary);
    if ('addressLine1' in body || 'address_line_1' in body) patch.addressLine1 = String((body.addressLine1 ?? body.address_line_1) || '').trim() || null;
    if ('addressLine2' in body || 'address_line_2' in body) patch.addressLine2 = s(body.addressLine2 ?? body.address_line_2);
    if ('city' in body) patch.city = String(body.city || '').trim() || null;
    if ('county' in body) patch.county = s(body.county);
    if ('state' in body) {
      if (!isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
      patch.state = normalizeState(body.state);
    }
    if ('zipCode' in body || 'zip_code' in body) {
      const z5 = normalizeZip5(body.zipCode ?? body.zip_code);
      if (!isValidZip5(z5)) return c.json({ error: 'zipCode must be 5 digits' }, 400);
      patch.zipCode = z5;
    }
    if ('zipPlus4' in body || 'zip_plus4' in body) {
      const z4 = normalizeZip4(body.zipPlus4 ?? body.zip_plus4);
      if (!isValidZip4(z4)) return c.json({ error: 'zipPlus4 must be 4 digits' }, 400);
      patch.zipPlus4 = z4;
    }
    if ('latitude' in body) {
      if (!isValidLatitude(body.latitude)) return c.json({ error: 'latitude must be between -90 and 90' }, 400);
      patch.latitude = body.latitude == null || String(body.latitude).trim() === '' ? null : String(Number(body.latitude));
    }
    if ('longitude' in body) {
      if (!isValidLongitude(body.longitude)) return c.json({ error: 'longitude must be between -180 and 180' }, 400);
      patch.longitude = body.longitude == null || String(body.longitude).trim() === '' ? null : String(Number(body.longitude));
    }
    if ('uspsStandardized' in body) patch.uspsStandardized = s(body.uspsStandardized);
    if ('rawInput' in body) patch.rawInput = s(body.rawInput);
    if ('verified' in body) patch.verified = Boolean(body.verified);
    if ('verificationDate' in body) {
      if (body.verificationDate != null && !isValidDateStr(body.verificationDate)) return c.json({ error: 'invalid verificationDate' }, 400);
      patch.verificationDate = body.verificationDate == null ? null : String(body.verificationDate).trim();
    }
    if ('dataSource' in body) patch.dataSource = (typeof body.dataSource === 'string' ? body.dataSource.trim() : '') || 'manual';
    if ('status' in body) {
      const nextStatus = (typeof body.status === 'string' ? body.status.trim() : '') || 'active';
      if (!allowedAddressStatuses.includes(nextStatus as any)) return c.json({ error: 'invalid status' }, 400);
      patch.status = nextStatus;
    }
    patch.updatedAt = new Date();

    // If entityType/entityId changed, re-validate target exists
    if ('entityType' in patch || 'entityId' in patch) {
      const nextType = patch.entityType;
      const nextId = patch.entityId;
      if (nextType === 'contact') {
        const exists = await db.select({ id: schema.contacts.id }).from(schema.contacts).where(eq(schema.contacts.id, nextId)).limit(1);
        if (exists.length === 0) return c.json({ error: 'Contact not found' }, 400);
      } else if (nextType === 'employee') {
        const exists = await db.select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, nextId)).limit(1);
        if (exists.length === 0) return c.json({ error: 'Employee not found' }, 400);
      }
    }

    // Validate validFrom <= validTo when either is being changed
    if ('validFrom' in body || 'validTo' in body) {
      const current = await db
        .select()
        .from(schema.addresses)
        .where(eq(schema.addresses.id, id))
        .limit(1);
      if (current.length === 0) return c.json({ error: 'Not found' }, 404);
      const nextFrom = Object.prototype.hasOwnProperty.call(patch, 'validFrom') ? patch.validFrom : (current[0] as any).validFrom;
      const nextTo = Object.prototype.hasOwnProperty.call(patch, 'validTo') ? patch.validTo : (current[0] as any).validTo;
      if (nextFrom != null && nextTo != null && !(String(nextFrom) <= String(nextTo))) {
        return c.json({ error: 'validFrom must be <= validTo' }, 400);
      }
    }

    try {
      const updated = await db.update(schema.addresses).set(patch).where(eq(schema.addresses.id, id)).returning();
      if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
      return c.json(updated[0]);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('uniq_addresses_primary_per_role')) return c.json({ error: 'PrimaryExists' }, 409);
      if (msg.includes('chk_valid_dates')) return c.json({ error: 'validFrom must be <= validTo' }, 400);
      throw e;
    }
  } catch (error) {
    console.error('Patch address error:', error);
    return c.json({ error: 'Failed to update address' }, 500);
  }
});

addressesRoutes.delete('/:addressId', async (c) => {
  try {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const id = c.req.param('addressId');
    const deleted = await db.delete(schema.addresses).where(eq(schema.addresses.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete address error:', error);
    return c.json({ error: 'Failed to delete address' }, 500);
  }
});

api.route('/addresses', addressesRoutes);

// Finally mount the API router now that all subroutes are attached
app.route('/api/v1', api);

export default app; 