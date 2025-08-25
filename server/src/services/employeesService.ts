import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/employeesRepo';

export async function listByDepartment(departmentId: string) {
  const db = await getDatabase();
  const rows = await repo.listEmployeesByDepartment(db, departmentId);
  return rows.map((e) => ({
    ...e,
    fullName: `${String(e.firstName ?? '').trim()}${e.firstName && e.lastName ? ' ' : ''}${String(e.lastName ?? '').trim()}`.trim() || e.name,
  }));
}

export async function create(departmentId: string, body: any) {
  const db = await getDatabase();
  const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
  const name = (String(body.name || '')).trim() || `${String(body.firstName || '').trim()} ${String(body.lastName || '').trim()}`.trim();
  if (!name) throw new Error('Name or firstName+lastName is required');

  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `emp_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  const rec = await repo.insertEmployee(db, {
    id,
    departmentId,
    name,
    priority: (typeof body.priority === 'number' ? body.priority : null) as any,
    firstName: f(body.firstName),
    middleName: f(body.middleName),
    lastName: f(body.lastName),
    address1: f(body.address1),
    address2: f(body.address2),
    city: f(body.city),
    state: f(body.state),
    postalCode: f(body.postalCode),
    postalCode4: f(body.postalCode4),
    primaryPhone: f(body.primaryPhone),
    email: f(body.email),
    emergencyContactName: f(body.emergencyContactName),
    emergencyContactPhone: f(body.emergencyContactPhone),
  } as any);
  const fullName = `${String(rec.firstName ?? '').trim()}${rec.firstName && rec.lastName ? ' ' : ''}${String(rec.lastName ?? '').trim()}`.trim() || rec.name;
  return { ...rec, fullName };
}

export async function patch(id: string, body: any) {
  const db = await getDatabase();
  const f = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
  const patch: any = {};
  if ('name' in body) patch.name = f(body.name);
  if ('priority' in body) patch.priority = body.priority == null ? null : Number(body.priority);
  if ('firstName' in body) patch.firstName = f(body.firstName);
  if ('middleName' in body) patch.middleName = f(body.middleName);
  if ('lastName' in body) patch.lastName = f(body.lastName);
  if ('address1' in body) patch.address1 = f(body.address1);
  if ('address2' in body) patch.address2 = f(body.address2);
  if ('city' in body) patch.city = f(body.city);
  if ('state' in body) patch.state = f(body.state);
  if ('postalCode' in body) patch.postalCode = f(body.postalCode);
  if ('postalCode4' in body) patch.postalCode4 = f(body.postalCode4);
  if ('primaryPhone' in body) patch.primaryPhone = f(body.primaryPhone);
  if ('email' in body) patch.email = f(body.email);
  if ('emergencyContactName' in body) patch.emergencyContactName = f(body.emergencyContactName);
  if ('emergencyContactPhone' in body) patch.emergencyContactPhone = f(body.emergencyContactPhone);
  patch.updatedAt = new Date();

  // Handle automatic name composition if only first/last updated
  if (("firstName" in body || "lastName" in body) && !("name" in body)) {
    const current = await repo.getEmployeeById(db, id);
    const nextFirst = ('firstName' in body ? (body.firstName ?? current?.firstName ?? '') : (current?.firstName ?? '')) as string;
    const nextLast = ('lastName' in body ? (body.lastName ?? current?.lastName ?? '') : (current?.lastName ?? '')) as string;
    const composed = `${String(nextFirst||'').trim()} ${String(nextLast||'').trim()}`.trim();
    if (composed) patch.name = composed;
  }

  const updated = await repo.updateEmployeeById(db, id, patch);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  const fullName = `${String(updated.firstName ?? '').trim()}${updated.firstName && updated.lastName ? ' ' : ''}${String(updated.lastName ?? '').trim()}`.trim() || updated.name;
  return { ...updated, fullName };
}

export async function remove(id: string) {
  const db = await getDatabase();
  await repo.deleteEmployeeById(db, id);
}


