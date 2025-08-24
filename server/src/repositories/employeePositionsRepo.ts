import { and, asc, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';

type Database = Awaited<ReturnType<typeof import('../lib/db').getDatabase>>;

export type EmployeePositionRecord = typeof schema.employeePositions.$inferSelect;
export type NewEmployeePositionRecord = typeof schema.employeePositions.$inferInsert;

export async function listEmployeePositionsByDepartment(db: Database, departmentId: string) {
  return db.select().from(schema.employeePositions).where(eq(schema.employeePositions.departmentId, departmentId));
}

export async function insertEmployeePosition(db: Database, record: NewEmployeePositionRecord) {
  const inserted = await db.insert(schema.employeePositions).values(record).returning();
  return inserted[0]!;
}

export async function updateEmployeePositionById(db: Database, id: string, patch: Partial<NewEmployeePositionRecord>) {
  const updated = await db.update(schema.employeePositions).set(patch as any).where(eq(schema.employeePositions.id, id)).returning();
  return updated[0] ?? null;
}


