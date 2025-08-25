import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/departmentsRepo';

export async function list(params: { q?: string }) {
  const db = await getDatabase();
  return repo.listDepartments(db, params);
}

export async function create(input: { name: string; description?: string | null }) {
  const db = await getDatabase();
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new Error('Name is required');
  const description = typeof input.description === 'string' ? input.description.trim() : null;

  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `dept_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  return repo.insertDepartment(db, { id, name, description } as any);
}

export async function get(id: string) {
  const db = await getDatabase();
  const row = await repo.getDepartmentById(db, id);
  if (!row) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return row;
}

export async function patch(id: string, body: Partial<{ name: string; description: string | null }>) {
  const db = await getDatabase();
  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (Object.prototype.hasOwnProperty.call(body, 'description')) patch.description = typeof body.description === 'string' ? body.description.trim() : null;
  patch.updatedAt = new Date();
  const updated = await repo.updateDepartmentById(db, id, patch);
  if (!updated) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return updated;
}


