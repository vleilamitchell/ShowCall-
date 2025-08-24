import { and, asc, eq, ilike, or } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type ContactRecord = typeof schema.contacts.$inferSelect;
export type NewContactRecord = typeof schema.contacts.$inferInsert;

export async function listContacts(db: Database, params: { q?: string }): Promise<ContactRecord[]> {
  const conditions: any[] = [];
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        ilike(schema.contacts.firstName, pattern),
        ilike(schema.contacts.lastName, pattern),
        ilike(schema.contacts.organization, pattern),
        ilike(schema.contacts.email, pattern)
      )
    );
  }
  const base = db.select().from(schema.contacts);
  const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return query.orderBy(asc(schema.contacts.lastName), asc(schema.contacts.firstName));
}

export async function insertContact(db: Database, record: NewContactRecord): Promise<ContactRecord> {
  const inserted = await db.insert(schema.contacts).values(record).returning();
  return inserted[0]!;
}

export async function getContactById(db: Database, id: string): Promise<ContactRecord | null> {
  const rows = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateContactById(db: Database, id: string, patch: Partial<NewContactRecord>): Promise<ContactRecord | null> {
  const updated = await db.update(schema.contacts).set(patch as any).where(eq(schema.contacts.id, id)).returning();
  return updated[0] ?? null;
}

export async function deleteContactById(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(schema.contacts).where(eq(schema.contacts.id, id)).returning();
  return deleted.length > 0;
}


