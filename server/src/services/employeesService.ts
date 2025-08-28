import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/employeesRepo';
import * as depts from '../repositories/departmentsRepo';
import * as empPos from '../repositories/employeePositionsRepo';
import * as schema from '../schema';
import * as usersRepo from '../repositories/usersRepo';
import { getFirebaseAdmin } from '../lib/firebase-admin';

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
    userId: f(body.userId),
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
  if ('userId' in body) patch.userId = f(body.userId);
  if ('emergencyContactName' in body) patch.emergencyContactName = f(body.emergencyContactName);
  if ('emergencyContactPhone' in body) patch.emergencyContactPhone = f(body.emergencyContactPhone);
  if ('departmentId' in body) patch.departmentId = f(body.departmentId);
  patch.updatedAt = new Date();

  // Handle automatic name composition if only first/last updated
  if (("firstName" in body || "lastName" in body) && !("name" in body)) {
    const current = await repo.getEmployeeById(db, id);
    const nextFirst = ('firstName' in body ? (body.firstName ?? current?.firstName ?? '') : (current?.firstName ?? '')) as string;
    const nextLast = ('lastName' in body ? (body.lastName ?? current?.lastName ?? '') : (current?.lastName ?? '')) as string;
    const composed = `${String(nextFirst||'').trim()} ${String(nextLast||'').trim()}`.trim();
    if (composed) patch.name = composed;
  }

  // If departmentId is set, optionally validate it exists
  let departmentChanged = false;
  let newDepartmentId: string | null = null;
  if (Object.prototype.hasOwnProperty.call(patch, 'departmentId')) {
    const nextDeptId = typeof patch.departmentId === 'string' ? String(patch.departmentId) : null;
    if (nextDeptId) {
      const exists = await depts.getDepartmentById(db as any, nextDeptId);
      if (!exists) {
        const err: any = new Error('Unknown departmentId');
        err.code = 'BadRequest';
        throw err;
      }
    }
    // Determine if it actually changes
    const current = await repo.getEmployeeById(db, id);
    if (!current) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
    departmentChanged = (nextDeptId || null) !== (current.departmentId || null);
    newDepartmentId = nextDeptId || null;
  }

  const updated = await repo.updateEmployeeById(db, id, patch);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }

  // Cleanup employee_positions if department changed
  if (departmentChanged && newDepartmentId) {
    await empPos.deleteAllForEmployeeNotInDepartment(db as any, id, newDepartmentId);
  }

  const fullName = `${String(updated.firstName ?? '').trim()}${updated.firstName && updated.lastName ? ' ' : ''}${String(updated.lastName ?? '').trim()}`.trim() || updated.name;
  return { ...updated, fullName };
}

export async function remove(id: string) {
  const db = await getDatabase();
  await repo.deleteEmployeeById(db, id);
}

// Create Firebase user (and local app user if needed) from employee's email, then link to employee.userId
export async function createAccountForEmployee(employeeId: string) {
  const db = await getDatabase();
  const employee = await repo.getEmployeeById(db, employeeId);
  if (!employee) { const e: any = new Error('Employee not found'); e.code = 'NotFound'; throw e; }
  const email = (employee.email || '').trim();
  if (!email) throw new Error('email required');

  // If already linked, just return current
  if (employee.userId) {
    const user = await usersRepo.getUserById(db as any, employee.userId);
    return { employeeId, user }; 
  }

  // Try to find existing local user by email
  let user = await usersRepo.getUserByEmail(db as any, email);

  // Create Firebase user if not exists via Admin (skip in dev if admin not available)
  let firebaseId: string | null = null;
  const adminApp = getFirebaseAdmin();
  try {
    if (adminApp) {
      // Attempt to get existing by email; if not exists, create
      try {
        const existing = await adminApp.auth().getUserByEmail(email);
        firebaseId = existing.uid;
      } catch {
        const created = await adminApp.auth().createUser({ email });
        firebaseId = created.uid;
      }
    }
  } catch (e: any) {
    // Surface admin errors explicitly
    throw new Error(`admin not available: ${e?.message || String(e)}`);
  }

  // Ensure local app user exists
  if (!user) {
    const id = firebaseId || (globalThis as any)?.crypto?.randomUUID?.() || `usr_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    user = await usersRepo.insertUser(db as any, { id, email } as any);
  }

  // Link employee to user
  const updated = await repo.updateEmployeeById(db, employeeId, { userId: user.id } as any);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  const fullName = `${String(updated.firstName ?? '').trim()}${updated.firstName && updated.lastName ? ' ' : ''}${String(updated.lastName ?? '').trim()}`.trim() || updated.name;
  return { ...updated, fullName };
}

// Link employee to an existing account, by userId or email
export async function linkEmployeeToAccount(employeeId: string, args: { userId?: string; email?: string }) {
  const db = await getDatabase();
  const employee = await repo.getEmployeeById(db, employeeId);
  if (!employee) { const e: any = new Error('Employee not found'); e.code = 'NotFound'; throw e; }

  let user = null as Awaited<ReturnType<typeof usersRepo.getUserById>> | null;
  if (args.userId) {
    user = await usersRepo.getUserById(db as any, String(args.userId));
    if (!user) throw new Error('User not found');
  } else if (args.email) {
    const email = String(args.email).trim();
    if (!email) throw new Error('email required');
    user = await usersRepo.getUserByEmail(db as any, email);
    if (!user) throw new Error('No account found for that email');
  } else {
    throw new Error('userId or email required');
  }

  const updated = await repo.updateEmployeeById(db, employeeId, { userId: user!.id } as any);
  if (!updated) { const e: any = new Error('NotFound'); e.code = 'NotFound'; throw e; }
  const fullName = `${String(updated.firstName ?? '').trim()}${updated.firstName && updated.lastName ? ' ' : ''}${String(updated.lastName ?? '').trim()}`.trim() || updated.name;
  return { ...updated, fullName };
}


