import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/positionsRepo';

export async function list(departmentId: string, params: { q?: string }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  return repo.listPositions(db, departmentId, params);
}

export async function create(departmentId: string, input: { name: string }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Name is required');
  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `pos_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  return repo.insertPosition(db, { id, departmentId, name } as any);
}

export async function patch(id: string, body: Partial<{ name: string }>) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  patch.updatedAt = new Date();
  const updated = await repo.updatePositionById(db, id, patch);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  return updated;
}

export async function remove(id: string) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  await repo.deletePositionById(db, id);
}


