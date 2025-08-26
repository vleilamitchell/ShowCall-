import 'dotenv/config';
import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { getDatabaseUrl } from './lib/env';
import * as schema from './schema';
import { and, asc, desc, eq, gte, gt, ilike, or, lte, isNull, sql, inArray } from 'drizzle-orm';
import { isValidEmail, isValidPhone, isValidState, isValidZip4, isValidZip5, normalizePhone, normalizeState, normalizeZip4, normalizeZip5, isValidDateStr, isValidTimeStr, isValidUrl, isValidColor, validateAreaName, isValidWeekdayMask, isValidFrequency } from './lib/validators';
import { listInventoryItems, createInventoryItem, getInventoryItem, patchInventoryItem } from './services/inventory/items';
import { postTransaction } from './services/inventory/postTransaction';
import { listTransactions } from './services/inventory/transactions';
import { getItemSummary } from './services/inventory/projections';
import { createReservation, listReservations, updateReservation } from './services/inventory/reservations';
// import { computeOccurrences, upsertEventsForSeries } from './services/events/recurrence';
// import { mountEventSeriesRoutes } from './routes/eventSeries';
import { isDevelopment } from './lib/env';

// API routes
const api = new Hono();
api.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Database test route - public for testing
api.get('/db-test', async (c) => {
  if (!isDevelopment()) {
    return c.json({ error: 'Not Found' }, 404);
  }
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

// Note: Legacy /protected/me handler removed in favor of routes/auth.ts during Phase 2

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
          ilike(schema.events.promoter, pattern)
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
      eventType: normalize(body.eventType),
      priority: (body.priority == null || String(body.priority).trim() === '') ? null : Number(body.priority),
      ticketUrl: normalize(body.ticketUrl),
      eventPageUrl: normalize(body.eventPageUrl),
      promoAssetsUrl: normalize(body.promoAssetsUrl),
      seriesId: (typeof body.seriesId === 'string' && body.seriesId.trim()) || null,
    } as const;

    // Validate URLs if provided
    if (!isValidUrl(record.ticketUrl)) return c.json({ error: 'invalid ticketUrl: must be http(s) URL' }, 400);
    if (!isValidUrl(record.eventPageUrl)) return c.json({ error: 'invalid eventPageUrl: must be http(s) URL' }, 400);
    if (!isValidUrl(record.promoAssetsUrl)) return c.json({ error: 'invalid promoAssetsUrl: must be http(s) URL' }, 400);

    // Validate priority range if provided
    if (!(record.priority == null || (Number.isFinite(record.priority) && record.priority >= 0 && record.priority <= 5))) {
      return c.json({ error: 'invalid priority: must be 0-5' }, 400);
    }

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
    if ('eventType' in body) patch.eventType = normalize(body.eventType);
    if ('priority' in body) {
      const p = (body.priority == null || String(body.priority).trim() === '') ? null : Number(body.priority);
      if (!(p == null || (Number.isFinite(p) && p >= 0 && p <= 5))) return c.json({ error: 'invalid priority: must be 0-5' }, 400);
      patch.priority = p;
    }
    if ('seriesId' in body) patch.seriesId = (typeof body.seriesId === 'string' && body.seriesId.trim()) ? body.seriesId.trim() : null;
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

// Mount nested under /events (handled by modular router in routes/eventAreas.ts)

// (order route defined above to avoid capture by :areaId) — handled by modular router in routes/areas.ts

// Mount extracted event-series routes (legacy mounting removed; modular router handles under /api/v1)

// Departments routes (protected under /api/v1/departments)
// Legacy departments routes removed; handled by modular router under routes/departments.ts

// Legacy departments list route removed; handled by modular router under routes/departments.ts

// Legacy departments create route removed; handled by modular router under routes/departments.ts

// Legacy departments get-by-id removed; handled by modular router under routes/departments.ts

// Legacy departments patch removed; handled by modular router under routes/departments.ts

// (mounted after all department routes are defined, including nested employees routes below)

// Eligibility route removed; handled by modular router in routes/positions.ts

// Employees routes (standalone under /employees for item-level ops)
// Legacy employees handlers removed; handled by modular router in routes/employees.ts

// Positions item-level routes
// Legacy positions handlers removed; handled by modular router in routes/positions.ts

// EmployeePositions item-level routes
// Legacy employee-positions handlers removed; handled by modular router in routes/employeePositions.ts

// Mount the API router (moved to end of file after all routes are attached)

// -------------------- Scheduling: Schedules, Shifts, Assignments --------------------
// Schedules legacy handlers removed; handled by modular router in routes/schedules.ts

// Shifts routes removed; handled by modular router in routes/shifts.ts

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

// Cross-department shifts list removed; handled by modular router in routes/shifts.ts

// Assignments legacy handlers removed; handled by modular router in routes/assignments.ts

// Mount departments handled by modular router in routes/departments.ts

// Inventory routes removed in favor of modular routers mounted in routes/index.ts

// Contacts legacy routes removed; handled by modular router in routes/contacts.ts

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

// Finally export the API router; mounting is handled in app.ts
export default api; 