import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function listTransactions(params: {
  itemId?: string;
  locationId?: string;
  eventType?: string | string[];
  from?: string; // ISO ts
  to?: string; // ISO ts
  limit?: number;
  order?: 'asc' | 'desc';
}) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const conditions: any[] = [];
  if (params.itemId) conditions.push(eq(schema.inventoryTxn.itemId, params.itemId));
  if (params.locationId) conditions.push(eq(schema.inventoryTxn.locationId, params.locationId));
  if (params.eventType) {
    const types = Array.isArray(params.eventType) ? params.eventType : String(params.eventType).split(',').map((s) => s.trim()).filter(Boolean);
    if (types.length === 1) conditions.push(eq(schema.inventoryTxn.eventType, types[0]!));
    else if (types.length > 1) conditions.push(((schema as any).inArray)(schema.inventoryTxn.eventType, types));
  }
  if (params.from) conditions.push(gte(schema.inventoryTxn.ts, params.from));
  if (params.to) conditions.push(lte(schema.inventoryTxn.ts, params.to));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const orderBy = (params.order || 'desc') === 'asc' ? asc(schema.inventoryTxn.ts) : desc(schema.inventoryTxn.ts);
  const limit = Math.max(1, Math.min(1000, Number(params.limit || 100)));
  const rows = await db
    .select()
    .from(schema.inventoryTxn)
    .where(whereClause as any)
    .orderBy(orderBy)
    .limit(limit);
  return rows;
}


