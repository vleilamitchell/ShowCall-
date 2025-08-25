import { and, desc, eq, sql } from 'drizzle-orm';
import { DatabaseConnection, getDatabase, withTransaction } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { refreshOnHandMaterializedView } from './projections';
import { convertToBaseUnits } from './units';
import { enforcePostingPolicies, loadPolicies } from './policies';

type PostTxnInput = {
  itemId: string;
  locationId: string;
  eventType: string;
  qtyBase?: number;
  qty?: number;
  unit?: string;
  lotId?: string | null;
  serialNo?: string | null;
  costPerBase?: number | null;
  sourceDoc?: any;
  postedBy: string;
  transfer?: { destinationLocationId: string } | null;
};

export async function postTransaction(input: PostTxnInput, dbOrTx?: DatabaseConnection) {
  const run = async (db: DatabaseConnection) => {

  // Minimal validations
  const item = (await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, input.itemId)).limit(1))[0];
  if (!item) { const { ValidationError } = await import('../../errors'); throw new ValidationError('Validation failed'); }
  const location = (await db.select().from(schema.locations).where(eq(schema.locations.locationId, input.locationId)).limit(1))[0];
  if (!location) { const { ValidationError } = await import('../../errors'); throw new ValidationError('Validation failed'); }

  // Support qty/unit or qtyBase
  let qtyBase: number | undefined = Number.isFinite(input.qtyBase as any) ? Number(input.qtyBase) : undefined;
  if (qtyBase == null) {
    if (Number.isFinite(input.qty as any) && typeof input.unit === 'string' && input.unit) {
      qtyBase = await convertToBaseUnits(String(item.baseUnit), Number(input.qty), String(input.unit), db);
    }
  }
  if (!Number.isFinite(qtyBase)) { const { ValidationError } = await import('../../errors'); throw new ValidationError('Validation failed'); }

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
    qtyBase: qtyBase!,
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
      qtyBase: Math.abs(qtyBase!),
    });
  } else if (input.eventType === 'COUNT_ADJUST') {
    // For MVP, treat as direct delta
    entries.push(baseEntry);
  } else {
    entries.push(baseEntry);
  }

  // Policies: load by department of location; tolerate empty
  let policies: any = {};
  try {
    policies = await loadPolicies(String(location.departmentId), String(item.itemType), db);
  } catch {
    policies = {};
  }

  // Compute simple on-hand prior to posting for enforcement using txn table
  const onHandAgg = await db
    .select({ qty: (sql as any)`COALESCE(SUM(${schema.inventoryTxn.qtyBase}), 0)` })
    .from(schema.inventoryTxn)
    .where(and(eq(schema.inventoryTxn.itemId, input.itemId), eq(schema.inventoryTxn.locationId, input.locationId)));
  const onHandQtyBase = Number((onHandAgg as any)[0]?.qty || 0);
  const reservationPresent = Boolean(input.sourceDoc && input.sourceDoc.eventId);
  const enforcement = enforcePostingPolicies({ policies, eventType: input.eventType, itemType: String(item.itemType), onHandQtyBase, reservationPresent });
  if (!('ok' in enforcement && enforcement.ok)) { const { ValidationError } = await import('../../errors'); throw new ValidationError('Validation failed'); }

  // Load current valuation prior to posting so we can assign COGS for negative movements
  const vaRowsPre = await db.select().from(schema.valuationAvg).where(eq(schema.valuationAvg.itemId, input.itemId)).limit(1);
  let avgCost = Number(vaRowsPre[0]?.avgCost || 0);
  let qtyVal = Number(vaRowsPre[0]?.qtyBase || 0);

  // Assign COGS for negative movements when not provided
  for (const e of entries) {
    const isNegativeMovement = (
      e.eventType === 'TRANSFER_OUT' ||
      e.eventType === 'MOVE_OUT' ||
      e.eventType === 'CONSUMPTION' ||
      e.eventType === 'WASTE' ||
      (e.eventType === 'COUNT_ADJUST' && Number(e.qtyBase) < 0)
    );
    if (isNegativeMovement && (e.costPerBase == null)) {
      e.costPerBase = avgCost;
    }
  }

  for (const e of entries) {
    await db.insert(schema.inventoryTxn).values(e);
  }

  // Valuation updates
  const isPositive = (et: string, q: number) => {
    if (et === 'TRANSFER_IN' || et === 'MOVE_IN' || et === 'RECEIPT') return q > 0;
    if (et === 'COUNT_ADJUST') return q >= 0;
    return false;
  };
  const isNegative = (et: string, q: number) => {
    if (et === 'TRANSFER_OUT' || et === 'MOVE_OUT' || et === 'CONSUMPTION' || et === 'WASTE') return q < 0 || q > 0; // any out movement reduces stock by |q|
    if (et === 'COUNT_ADJUST') return q < 0;
    return false;
  };

  for (const e of entries) {
    const q = Number(e.qtyBase);
    if (isPositive(e.eventType, q)) {
      const incomingCost = Number(e.costPerBase ?? 0);
      const newQty = qtyVal + Math.abs(q);
      const newAvg = newQty > 0 ? ((avgCost * qtyVal) + (incomingCost * Math.abs(q))) / newQty : avgCost;
      avgCost = newAvg;
      qtyVal = newQty;
    } else if (isNegative(e.eventType, q)) {
      // use current avg as COGS if not provided
      // costPerBase was assigned before insert when missing
      const newQty = Math.max(0, qtyVal - Math.abs(q));
      qtyVal = newQty;
      // avgCost unchanged when qty remains > 0
      if (qtyVal === 0) {
        avgCost = avgCost; // keep stable non-NaN behavior
      }
    }
  }

  await db
    .insert(schema.valuationAvg)
    .values({ itemId: input.itemId, avgCost: avgCost as any, qtyBase: qtyVal as any })
    .onConflictDoUpdate({
      target: schema.valuationAvg.itemId,
      set: { avgCost: avgCost as any, qtyBase: qtyVal as any, updatedAt: new Date() },
    });

    return entries;
  };

  const entries = dbOrTx
    ? await run(dbOrTx)
    : await withTransaction(run);
  // Refresh projections OUTSIDE of any transaction context to avoid CONCURRENTLY errors
  await refreshOnHandMaterializedView();
  return entries;
}


