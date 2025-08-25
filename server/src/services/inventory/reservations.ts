import { and, asc, eq, sql } from 'drizzle-orm';
import { DatabaseConnection, getDatabase, withTransaction } from '../../lib/db';
import { ValidationError } from '../../errors';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import * as resRepo from '../../repositories/inventory/reservationsRepo';

export async function createReservation(input: { itemId: string; locationId: string; eventId: string; qtyBase: number; startTs: string; endTs: string; }, dbOrTx?: DatabaseConnection) {
  const run = async (db: DatabaseConnection) => {
    // Validate item and location exist (map missing to validation error)
    const item = (await db.select({ id: schema.inventoryItems.itemId }).from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, input.itemId)).limit(1))[0];
    const loc = (await db.select({ id: schema.locations.locationId }).from(schema.locations).where(eq(schema.locations.locationId, input.locationId)).limit(1))[0];
    if (!item || !loc) {
      throw new ValidationError('Validation failed');
    }
    // Enforce mutual exclusion: overlapping active reservations for same item/location are not allowed
    const from = new Date(input.startTs);
    const to = new Date(input.endTs);
    const overlapping = await db
      .select({ resId: schema.reservations.resId })
      .from(schema.reservations)
      .where(and(
        eq(schema.reservations.itemId, input.itemId),
        eq(schema.reservations.locationId, input.locationId),
        eq(schema.reservations.status, 'HELD' as any),
        // NOT (end_ts < start OR start_ts > end)
        sql`NOT (${schema.reservations.endTs.name} < ${from.toISOString()} OR ${schema.reservations.startTs.name} > ${to.toISOString()})`
      ))
      .limit(1);
    if ((overlapping as any[]).length > 0) {
      throw new ValidationError('Validation failed');
    }
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
    return resRepo.insert(rec as any, db);
  };
  if (dbOrTx) return run(dbOrTx);
  return withTransaction(run);
}

export async function listReservations(params: { itemId?: string; eventId?: string }, dbOrTx?: DatabaseConnection) {
  return resRepo.list(params, dbOrTx);
}

export async function updateReservation(resId: string, action: 'RELEASE' | 'FULFILL', dbOrTx?: DatabaseConnection) {
  const run = async (db: DatabaseConnection) => {
    const status = action === 'RELEASE' ? 'RELEASED' : 'FULFILLED';
    return resRepo.updateStatus(resId, status, db);
  };
  if (dbOrTx) return run(dbOrTx);
  return withTransaction(run);
}


