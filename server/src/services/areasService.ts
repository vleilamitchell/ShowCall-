import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { validateAreaName, isValidColor } from '../lib/validators';
import * as repo from '../repositories/areasRepo';

export async function list(params: { q?: string; active?: boolean | null }) {
  const db = await getDatabase();
  return repo.listAreas(db, params);
}

export async function create(input: { id?: string; name: string; description?: string | null; color?: string | null; active?: boolean }) {
  const db = await getDatabase();
  if (!validateAreaName(input.name)) throw new Error('invalid name');
  const name = input.name.trim();
  const description = (typeof input.description === 'string' ? input.description.trim() : '') || null;
  const color = (typeof input.color === 'string' ? input.color.trim() : '') || null;
  const active = input.active == null ? true : Boolean(input.active);
  if (!isValidColor(color)) throw new Error('invalid color');

  let id: string | undefined;
  const g: any = globalThis as any;
  const requestedId = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : undefined;
  if (requestedId) {
    id = requestedId;
  } else {
    if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
    if (!id) {
      try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {}
    }
    if (!id) id = `area_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  }

  try {
    return await repo.insertArea(db, { id, name, description, color, active } as any);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('areas_name_unique')) {
      const err: any = new Error('Name must be unique');
      err.code = 'Conflict';
      throw err;
    }
    throw e;
  }
}

export async function patch(areaId: string, body: Partial<{ name: string; description: string | null; color: string | null; active: boolean }>) {
  const db = await getDatabase();
  const patch: any = {};
  if (typeof body.name === 'string') {
    if (!validateAreaName(body.name)) throw new Error('invalid name');
    patch.name = body.name.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = typeof body.description === 'string' ? body.description.trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'color')) {
    const color = (typeof body.color === 'string' ? body.color.trim() : '');
    if (!isValidColor(color)) throw new Error('invalid color');
    patch.color = color || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'active')) patch.active = Boolean(body.active);
  patch.updatedAt = new Date();

  try {
    const updated = await repo.updateAreaById(db, areaId, patch);
    if (!updated) {
      const err: any = new Error('Not found');
      err.code = 'NotFound';
      throw err;
    }
    return updated;
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('areas_name_unique')) {
      const err: any = new Error('Name must be unique');
      err.code = 'Conflict';
      throw err;
    }
    throw e;
  }
}

export async function remove(areaId: string) {
  const db = await getDatabase();
  try {
    await repo.deleteAreaById(db, areaId);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('event_areas_area_fk') || msg.includes('delete restrict')) {
      const err: any = new Error('AreaInUse');
      err.code = 'AreaInUse';
      throw err;
    }
    throw e;
  }
  return true;
}

export async function reorder(ids: string[]) {
  const db = await getDatabase();
  try {
    return await repo.reorderAreas(db, ids);
  } catch (e: any) {
    if (String(e?.code) === 'UnknownIds') {
      const err: any = new Error('Unknown ids');
      err.code = 'BadRequest';
      err.details = e.details;
      throw err;
    }
    throw e;
  }
}


