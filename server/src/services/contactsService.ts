import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as repo from '../repositories/contactsRepo';
import { normalizePhone, normalizeState, normalizeZip5 } from '../lib/validators';

export async function list(params: { q?: string }) {
  const db = await getDatabase();
  return repo.listContacts(db, params);
}

export async function create(input: Partial<repo.NewContactRecord>) {
  const db = await getDatabase();

  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) { try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {} }
  if (!id) id = `ct_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));

  const record: repo.NewContactRecord = {
    id,
    prefix: s(input.prefix),
    firstName: s(input.firstName),
    lastName: s(input.lastName),
    suffix: s(input.suffix),
    address1: s(input.address1),
    address2: s(input.address2),
    city: s(input.city),
    state: input.state == null ? null : normalizeState(input.state),
    postalCode: input.postalCode == null ? null : normalizeZip5(input.postalCode),
    email: s(input.email),
    paymentDetails: s(input.paymentDetails),
    contactNumber: input.contactNumber == null ? null : normalizePhone(input.contactNumber),
    organization: s(input.organization),
  } as any;

  return repo.insertContact(db, record);
}

export async function get(id: string) {
  const db = await getDatabase();
  const row = await repo.getContactById(db, id);
  if (!row) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return row;
}

export async function patch(id: string, body: Partial<repo.NewContactRecord>) {
  const db = await getDatabase();
  const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v as any)));
  const patch: any = {};
  if ('prefix' in body) patch.prefix = s(body.prefix);
  if ('firstName' in body) patch.firstName = s(body.firstName);
  if ('lastName' in body) patch.lastName = s(body.lastName);
  if ('suffix' in body) patch.suffix = s(body.suffix);
  if ('address1' in body) patch.address1 = s(body.address1);
  if ('address2' in body) patch.address2 = s(body.address2);
  if ('city' in body) patch.city = s(body.city);
  if ('state' in body) patch.state = body.state == null ? null : normalizeState(body.state);
  if ('postalCode' in body) patch.postalCode = body.postalCode == null ? null : normalizeZip5(body.postalCode);
  if ('email' in body) patch.email = s(body.email);
  if ('paymentDetails' in body) patch.paymentDetails = s(body.paymentDetails);
  if ('contactNumber' in body) patch.contactNumber = body.contactNumber == null ? null : normalizePhone(body.contactNumber);
  if ('organization' in body) patch.organization = s(body.organization);
  patch.updatedAt = new Date();
  const updated = await repo.updateContactById(db, id, patch);
  if (!updated) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
  return updated;
}

export async function remove(id: string) {
  const db = await getDatabase();
  const ok = await repo.deleteContactById(db, id);
  if (!ok) { const e: any = new Error('Not found'); e.code = 'NotFound'; throw e; }
}


