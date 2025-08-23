import { and, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function refreshOnHandMaterializedView() {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  // Drizzle-ORM allows raw SQL via db.execute
  await (db as any).execute(`REFRESH MATERIALIZED VIEW CONCURRENTLY on_hand`);
}

export async function getItemSummary(itemId: string, params?: { from?: string; to?: string }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  // Note: The SQL view `availability` is not window-aware; we compute windowed
  // reservations overlap here in the service using the requested [from, to] window.
  // onHand by location/lot from MV
  const onHandRows = await (db as any).execute(
    `SELECT location_id as "locationId", lot_id as "lotId", SUM(qty_base) as "qtyBase" FROM on_hand WHERE item_id = $1 GROUP BY location_id, lot_id`,
    [itemId]
  );
  const onHand = Array.from(onHandRows as any[]).map((r: any) => ({ locationId: r.locationId, lotId: r.lotId, qtyBase: Number(r.qtyBase) }));
  const totalOnHand = onHand.reduce((acc: number, r: any) => acc + Number(r.qtyBase || 0), 0);

  // Window for reservations
  const from = params?.from ? new Date(params.from) : new Date();
  const to = params?.to ? new Date(params.to) : new Date();
  const reservedRows = await db
    .select({ qtyBase: schema.reservations.qtyBase })
    .from(schema.reservations)
    .where(and(
      eq(schema.reservations.itemId, itemId),
      eq(schema.reservations.status, 'HELD' as any),
      // NOT (end_ts < from OR start_ts > to)
      sql`NOT (${schema.reservations.endTs.name} < ${from.toISOString()} OR ${schema.reservations.startTs.name} > ${to.toISOString()})`
    ));
  const reserved = reservedRows.reduce((acc: number, r: any) => acc + Number(r.qtyBase || 0), 0);
  const available = totalOnHand - reserved;
  return { onHand, totals: { onHand: totalOnHand, reserved, available } };
}


