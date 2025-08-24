import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/employeePositionsRepo';
import * as schema from '../schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function create(input: { departmentId: string; employeeId: string; positionId: string; priority?: number | null; isLead?: boolean }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  if (!input.departmentId || !input.employeeId || !input.positionId) throw new Error('departmentId, employeeId, and positionId are required');
  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `ep_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  return repo.insertEmployeePosition(db, { id, departmentId: input.departmentId, employeeId: input.employeeId, positionId: input.positionId, priority: input.priority ?? null, isLead: Boolean(input.isLead) } as any);
}

export async function batchUpdateForPosition(positionId: string, items: Array<{ id: string; priority: number; isLead?: boolean }>) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  if (!Array.isArray(items) || items.length === 0) throw new Error('items required');
  const ids = items.map((i) => String(i.id || ''));
  const rows = await db.select().from(schema.employeePositions).where((inArray as any)(schema.employeePositions.id, ids));
  const invalid = rows.some((r: any) => r.positionId !== positionId);
  if (invalid) throw new Error('Items must belong to the position');

  const updated: any[] = [];
  for (const item of items) {
    const patch: any = { priority: Number(item.priority) };
    if ('isLead' in item) patch.isLead = Boolean(item.isLead);
    const res = await db.update(schema.employeePositions).set(patch).where(eq(schema.employeePositions.id, item.id)).returning();
    if (res[0]) updated.push(res[0]);
  }
  return updated;
}

export async function listEligible(departmentId: string, positionId: string) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const rows = await db
    .select({ id: schema.employees.id, name: schema.employees.name, priority: schema.employeePositions.priority })
    .from(schema.employeePositions)
    .innerJoin(
      schema.employees,
      and(eq(schema.employees.id, schema.employeePositions.employeeId), eq(schema.employees.departmentId, departmentId))
    )
    .where(and(eq(schema.employeePositions.departmentId, departmentId), eq(schema.employeePositions.positionId, positionId)));
  return rows.slice().sort((a: any, b: any) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)) || a.name.localeCompare(b.name));
}


