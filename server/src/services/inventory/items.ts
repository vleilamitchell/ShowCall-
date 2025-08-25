import { and, asc, eq, ilike } from 'drizzle-orm';
import { DatabaseConnection, getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { validateItemAttributes } from './validation';
import * as itemsRepo from '../../repositories/inventory/itemsRepo';

export async function listInventoryItems(params: { q?: string; itemType?: string; departmentId?: string; active?: boolean }, dbOrTx?: DatabaseConnection) {
  // Delegate read to repository (departmentId currently unused in repo implementation)
  return itemsRepo.findAll({ q: params.q, itemType: params.itemType, active: params.active }, dbOrTx);
}

export async function createInventoryItem(input: {
  sku: string;
  name: string;
  itemType: string;
  baseUnit: string;
  schemaId?: string; // optional: resolve by itemType if missing
  attributes: any;
  categoryId?: string | null;
}, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase());
  // Generate ID
  const g: any = globalThis as any;
  let id: string | undefined;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) {
    try { const crypto = await import('node:crypto'); if (crypto.randomUUID) id = crypto.randomUUID(); } catch {}
  }
  if (!id) id = `itm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Resolve schemaId if not provided: choose latest version by itemType
  let schemaId = String(input.schemaId || '');
  if (!schemaId) {
    const row = (await db
      .select({ schemaId: schema.attributeSchema.schemaId, version: schema.attributeSchema.version })
      .from(schema.attributeSchema)
      .where(eq(schema.attributeSchema.itemType, input.itemType as any))
      .orderBy((asc as any)((schema.attributeSchema.version as any) as any))
    ).pop();
    if (!row) {
      // Fallback to generic Consumable schema when not found
      const fallback = (await db
        .select({ schemaId: schema.attributeSchema.schemaId, version: schema.attributeSchema.version })
        .from(schema.attributeSchema)
        .where(eq(schema.attributeSchema.itemType, 'Consumable' as any))
        .orderBy((asc as any)((schema.attributeSchema.version as any) as any))
      ).pop();
      if (!fallback) {
        throw new Error(`attribute schema not found for itemType: ${input.itemType}`);
      }
      schemaId = String(fallback.schemaId);
    } else {
      schemaId = String(row.schemaId);
    }
  }

  // Validate attributes against schema
  const validation = await validateItemAttributes(String(schemaId), input.attributes ?? {});
  if (!validation.ok) {
    throw new Error(`attributes invalid: ${validation.message}${validation.path ? ` at ${validation.path}` : ''}`);
  }

  const record = {
    itemId: id,
    sku: input.sku.trim(),
    name: input.name.trim(),
    itemType: input.itemType,
    baseUnit: input.baseUnit,
    schemaId,
    attributes: input.attributes ?? {},
    categoryId: input.categoryId ?? null,
  } as const;

  const inserted = await db.insert(schema.inventoryItems).values(record).returning();
  return inserted[0];
}

export async function getInventoryItem(itemId: string, dbOrTx?: DatabaseConnection) {
  return itemsRepo.findById(itemId, dbOrTx);
}

export async function patchInventoryItem(itemId: string, patch: Partial<{ name: string; baseUnit: string; attributes: any; active: boolean }>, dbOrTx?: DatabaseConnection) {
  const db = dbOrTx || (await getDatabase());
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


