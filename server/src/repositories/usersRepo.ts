import { and, asc, eq, ilike, or } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type UserRecord = typeof schema.users.$inferSelect;
export type NewUserRecord = typeof schema.users.$inferInsert;

export async function listUsers(db: Database, params: { q?: string }): Promise<UserRecord[]> {
  const conditions: any[] = [];
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        ilike(schema.users.email, pattern),
        ilike(schema.users.display_name, pattern)
      )
    );
  }
  const base = db.select().from(schema.users);
  const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return query.orderBy(asc(schema.users.email));
}

export async function getUserById(db: Database, id: string): Promise<UserRecord | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(db: Database, email: string): Promise<UserRecord | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function insertUser(db: Database, record: NewUserRecord): Promise<UserRecord> {
  const inserted = await db.insert(schema.users).values(record as any).returning();
  return inserted[0]!;
}

export async function updateUserById(
  db: Database,
  id: string,
  patch: Partial<Pick<UserRecord, 'display_name' | 'photo_url'>>
): Promise<UserRecord | null> {
  const updated = await db
    .update(schema.users)
    .set({ ...patch, updated_at: new Date() } as any)
    .where(eq(schema.users.id, id))
    .returning();
  return updated[0] ?? null;
}

export async function deleteUserById(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
  return deleted.length > 0;
}


