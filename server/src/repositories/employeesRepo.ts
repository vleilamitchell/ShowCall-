import { and, asc, eq } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type EmployeeRecord = typeof schema.employees.$inferSelect;
export type NewEmployeeRecord = typeof schema.employees.$inferInsert;

export async function listEmployeesByDepartment(db: Database, departmentId: string): Promise<EmployeeRecord[]> {
  return db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.departmentId, departmentId))
    .orderBy(asc(schema.employees.name));
}

export async function getEmployeeById(db: Database, id: string): Promise<EmployeeRecord | null> {
  const rows = await db.select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertEmployee(db: Database, record: NewEmployeeRecord): Promise<EmployeeRecord> {
  const inserted = await db.insert(schema.employees).values(record).returning();
  return inserted[0]!;
}

export async function updateEmployeeById(db: Database, id: string, patch: Partial<NewEmployeeRecord>): Promise<EmployeeRecord | null> {
  const updated = await db.update(schema.employees).set(patch as any).where(eq(schema.employees.id, id)).returning();
  return updated[0] ?? null;
}

export async function deleteEmployeeById(db: Database, id: string): Promise<void> {
  await db.delete(schema.employees).where(eq(schema.employees.id, id));
}


