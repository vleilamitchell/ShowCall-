import { asc, eq, ilike, and } from 'drizzle-orm';
import { DatabaseConnection, getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function findAll(params: { q?: string; itemType?: string; active?: boolean }, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres'));
  const conditions: any[] = [];
  if (params.q) conditions.push(ilike(schema.inventoryItems.name, `%${params.q}%`));
  if (params.itemType) conditions.push(eq(schema.inventoryItems.itemType, params.itemType));
  if (params.active != null) conditions.push(eq(schema.inventoryItems.active, params.active));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return db.select().from(schema.inventoryItems).where(whereClause as any).orderBy(asc(schema.inventoryItems.name));
}

export async function findById(itemId: string, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres'));
  const rows = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, itemId)).limit(1);
  return rows[0] || null;
}


