import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { addresses as addressesTable } from '../schema/addresses';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type AddressRecord = typeof schema.addresses.$inferSelect;
export type NewAddressRecord = typeof schema.addresses.$inferInsert;

export async function listAddresses(db: Database, params: {
  entityType?: string;
  entityId?: string;
  role?: string;
  status?: string;
  isPrimary?: boolean | null;
  q?: string;
}): Promise<AddressRecord[]> {
  const conditions: any[] = [];
  if (params.entityType) conditions.push(eq(schema.addresses.entityType, params.entityType));
  if (params.entityId) conditions.push(eq(schema.addresses.entityId, params.entityId));
  if (params.role) conditions.push(eq(schema.addresses.role, params.role));
  if (params.status) conditions.push(eq(schema.addresses.status, params.status));
  if (params.isPrimary != null) conditions.push(eq(schema.addresses.isPrimary, params.isPrimary));
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(or(ilike(schema.addresses.city, pattern), ilike(schema.addresses.addressLine1, pattern)));
  }

  const base = db
    .select()
    .from(schema.addresses);
  const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return query.orderBy(desc(schema.addresses.isPrimary), desc(schema.addresses.updatedAt));
}

export async function insertAddress(db: Database, record: NewAddressRecord): Promise<AddressRecord> {
  const inserted = await db.insert(schema.addresses).values(record).returning();
  return inserted[0];
}

export async function getAddressById(db: Database, addressId: string): Promise<AddressRecord | null> {
  const rows = await db.select().from(schema.addresses).where(eq(schema.addresses.id, addressId)).limit(1);
  return rows[0] ?? null;
}

export async function updateAddressById(db: Database, addressId: string, patch: Partial<NewAddressRecord>): Promise<AddressRecord | null> {
  const updated = await db.update(schema.addresses).set(patch as any).where(eq(schema.addresses.id, addressId)).returning();
  return updated[0] ?? null;
}

export async function deleteAddressById(db: Database, addressId: string): Promise<boolean> {
  const deleted = await db.delete(schema.addresses).where(eq(schema.addresses.id, addressId)).returning();
  return deleted.length > 0;
}


