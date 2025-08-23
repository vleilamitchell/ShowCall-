import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { refreshOnHandMaterializedView } from './projections';

type PostTxnInput = {
  itemId: string;
  locationId: string;
  eventType: string;
  qtyBase: number;
  lotId?: string | null;
  serialNo?: string | null;
  costPerBase?: number | null;
  sourceDoc?: any;
  postedBy: string;
  transfer?: { destinationLocationId: string } | null;
};

export async function postTransaction(input: PostTxnInput) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');

  // Minimal validations (policies TBD)
  const item = (await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, input.itemId)).limit(1))[0];
  if (!item) throw new Error('Item not found');
  const location = (await db.select().from(schema.locations).where(eq(schema.locations.locationId, input.locationId)).limit(1))[0];
  if (!location) throw new Error('Location not found');
  if (!Number.isFinite(input.qtyBase)) throw new Error('qtyBase required');

  const g: any = globalThis as any;
  const genId = async (prefix: string) => {
    let id: string | undefined;
    if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
    if (!id) { try { const c = await import('node:crypto'); if (c.randomUUID) id = c.randomUUID(); } catch {} }
    if (!id) id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return id;
  };

  const entries: any[] = [];

  const baseEntry = {
    txnId: await genId('txn'),
    itemId: input.itemId,
    locationId: input.locationId,
    eventType: input.eventType,
    qtyBase: input.qtyBase,
    lotId: input.lotId ?? null,
    serialNo: input.serialNo ?? null,
    costPerBase: input.costPerBase ?? null,
    sourceDoc: input.sourceDoc ?? null,
    postedBy: input.postedBy,
  } as const;

  if (input.eventType === 'TRANSFER_OUT') {
    if (!input.transfer?.destinationLocationId) throw new Error('destinationLocationId required for transfer');
    entries.push(baseEntry);
    entries.push({
      ...baseEntry,
      txnId: await genId('txn'),
      locationId: input.transfer.destinationLocationId,
      eventType: 'TRANSFER_IN',
      qtyBase: Math.abs(input.qtyBase),
    });
  } else if (input.eventType === 'COUNT_ADJUST') {
    // For MVP, treat as direct delta
    entries.push(baseEntry);
  } else {
    entries.push(baseEntry);
  }

  for (const e of entries) {
    await db.insert(schema.inventoryTxn).values(e);
  }

  // Update projections
  await refreshOnHandMaterializedView();
  return entries;
}


