import { and, asc, ilike, eq, or } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type DepartmentRecord = typeof schema.departments.$inferSelect;
export type NewDepartmentRecord = typeof schema.departments.$inferInsert;

export async function listDepartments(db: Database, params: { q?: string }): Promise<DepartmentRecord[]> {
  const conditions: any[] = [];
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        ilike(schema.departments.name, pattern),
        ilike(schema.departments.description, pattern)
      )
    );
  }
  const base = db.select().from(schema.departments);
  const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return query.orderBy(asc(schema.departments.name));
}

export async function insertDepartment(db: Database, record: NewDepartmentRecord): Promise<DepartmentRecord> {
  const inserted = await db.insert(schema.departments).values(record).returning();
  return inserted[0]!;
}

export async function getDepartmentById(db: Database, id: string): Promise<DepartmentRecord | null> {
  const rows = await db.select().from(schema.departments).where(eq(schema.departments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateDepartmentById(db: Database, id: string, patch: Partial<NewDepartmentRecord>): Promise<DepartmentRecord | null> {
  const updated = await db.update(schema.departments).set(patch as any).where(eq(schema.departments.id, id)).returning();
  return updated[0] ?? null;
}


