import { and, asc, between, eq, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function createReservation(input: { itemId: string; locationId: string; eventId: string; qtyBase: number; startTs: string; endTs: string; }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const c = await import('node:crypto'); if (c.randomUUID) id = c.randomUUID(); } catch {} }
  if (!id) id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const rec = {
    resId: id,
    itemId: input.itemId,
    locationId: input.locationId,
    eventId: input.eventId,
    qtyBase: input.qtyBase,
    startTs: new Date(input.startTs),
    endTs: new Date(input.endTs),
    status: 'HELD' as const,
  } as const;
  const inserted = await db.insert(schema.reservations).values(rec).returning();
  return inserted[0];
}

export async function listReservations(params: { itemId?: string; eventId?: string }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const conditions: any[] = [];
  if (params.itemId) conditions.push(eq(schema.reservations.itemId, params.itemId));
  if (params.eventId) conditions.push(eq(schema.reservations.eventId, params.eventId));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return db.select().from(schema.reservations).where(whereClause as any).orderBy(asc(schema.reservations.startTs));
}

export async function updateReservation(resId: string, action: 'RELEASE' | 'FULFILL') {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const status = action === 'RELEASE' ? 'RELEASED' : 'FULFILLED';
  const updated = await db.update(schema.reservations).set({ status, updatedAt: new Date() }).where(eq(schema.reservations.resId, resId)).returning();
  return updated[0] || null;
}


