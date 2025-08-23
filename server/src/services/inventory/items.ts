import { and, asc, eq, ilike } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { validateItemAttributes } from './validation';

export async function listInventoryItems(params: { q?: string; itemType?: string; departmentId?: string; active?: boolean }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const conditions: any[] = [];
  if (params.q) {
    const p = `%${params.q}%`;
    conditions.push(ilike(schema.inventoryItems.name, p));
  }
  if (params.itemType) conditions.push(eq(schema.inventoryItems.itemType, params.itemType));
  if (params.active != null) conditions.push(eq(schema.inventoryItems.active, params.active));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return db.select().from(schema.inventoryItems).where(whereClause as any).orderBy(asc(schema.inventoryItems.name));
}

export async function createInventoryItem(input: {
  sku: string;
  name: string;
  itemType: string;
  baseUnit: string;
  schemaId: string;
  attributes: any;
  categoryId?: string | null;
}) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  // Generate ID
  const g: any = globalThis as any;
  let id: string | undefined;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) {
    try { const crypto = await import('node:crypto'); if (crypto.randomUUID) id = crypto.randomUUID(); } catch {}
  }
  if (!id) id = `itm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Validate attributes against schema
  const validation = await validateItemAttributes(String(input.schemaId), input.attributes ?? {});
  if (!validation.ok) {
    throw new Error(`attributes invalid: ${validation.message}${validation.path ? ` at ${validation.path}` : ''}`);
  }

  const record = {
    itemId: id,
    sku: input.sku.trim(),
    name: input.name.trim(),
    itemType: input.itemType,
    baseUnit: input.baseUnit,
    schemaId: input.schemaId,
    attributes: input.attributes ?? {},
    categoryId: input.categoryId ?? null,
  } as const;

  const inserted = await db.insert(schema.inventoryItems).values(record).returning();
  return inserted[0];
}

export async function getInventoryItem(itemId: string) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const rows = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, itemId)).limit(1);
  return rows[0] || null;
}

export async function patchInventoryItem(itemId: string, patch: Partial<{ name: string; baseUnit: string; attributes: any; active: boolean }>) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const update: any = {};
  if (typeof patch.name === 'string') update.name = patch.name.trim();
  if (typeof patch.baseUnit === 'string') update.baseUnit = patch.baseUnit.trim();
  if (patch.attributes !== undefined) {
    // Load current schemaId for validation
    const cur = (await db.select({ schemaId: schema.inventoryItems.schemaId }).from(schema.inventoryItems).where(eq(schema.inventoryItems.itemId, itemId)).limit(1))[0];
    const validation = await validateItemAttributes(String(cur?.schemaId || ''), patch.attributes);
    if (!validation.ok) {
      throw new Error(`attributes invalid: ${validation.message}${validation.path ? ` at ${validation.path}` : ''}`);
    }
    update.attributes = patch.attributes;
  }
  if (typeof patch.active === 'boolean') update.active = patch.active;
  update.updatedAt = new Date();
  const updated = await db.update(schema.inventoryItems).set(update).where(eq(schema.inventoryItems.itemId, itemId)).returning();
  return updated[0] || null;
}


