import { getDatabase } from '../lib/db';
import * as repo from '../repositories/usersRepo';
import { deleteFirebaseUser } from '../lib/firebase-admin';

export async function list(params: { q?: string }) {
  const db = await getDatabase();
  return repo.listUsers(db, params);
}

export async function get(id: string) {
  const db = await getDatabase();
  const row = await repo.getUserById(db, id);
  if (!row) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return row;
}

export async function patch(id: string, body: Partial<{ display_name: string | null; photo_url: string | null }>) {
  const db = await getDatabase();
  const sanitize = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
  const patch: any = {};
  if ('display_name' in body) patch.display_name = sanitize(body.display_name);
  if ('photo_url' in body) patch.photo_url = sanitize(body.photo_url);
  const updated = await repo.updateUserById(db, id, patch);
  if (!updated) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return updated;
}

export async function remove(id: string) {
  const db = await getDatabase();
  // First attempt Firebase delete; ignore not-found
  await deleteFirebaseUser(id);
  const ok = await repo.deleteUserById(db, id);
  if (!ok) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
}


