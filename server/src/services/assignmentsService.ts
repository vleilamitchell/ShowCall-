import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as schema from '../schema';

const conn = async () => getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');

export async function listByDepartment(departmentId: string, params: { shiftId?: string }) {
  const db = await conn();
  const conditions: any[] = [eq(schema.assignments.departmentId, departmentId)];
  if (params.shiftId) conditions.push(eq(schema.assignments.shiftId, params.shiftId));
  const where = conditions.length > 1 ? and(...conditions) : conditions[0];
  return db.select().from(schema.assignments).where(where as any);
}

export async function create(departmentId: string, body: any) {
  const db = await conn();
  const shiftId = String(body.shiftId || '').trim();
  const requiredPositionId = String(body.requiredPositionId || '').trim();
  const assigneeEmployeeId = String(body.assigneeEmployeeId || '').trim() || null;
  if (!shiftId || !requiredPositionId) throw new Error('shiftId and requiredPositionId required');

  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `asg_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  const inserted = await db.insert(schema.assignments).values({ id, departmentId, shiftId, requiredPositionId, assigneeEmployeeId: assigneeEmployeeId as any }).returning();
  return inserted[0]!;
}

export async function patch(id: string, body: any) {
  const db = await conn();
  const patch: any = {};
  if ('assigneeEmployeeId' in body) patch.assigneeEmployeeId = (body.assigneeEmployeeId == null || String(body.assigneeEmployeeId).trim() === '') ? null : String(body.assigneeEmployeeId).trim();
  patch.updatedAt = new Date();
  const updated = await db.update(schema.assignments).set(patch).where(eq(schema.assignments.id, id)).returning();
  return updated[0] ?? null;
}

export async function remove(id: string) {
  const db = await conn();
  await db.delete(schema.assignments).where(eq(schema.assignments.id, id));
}


