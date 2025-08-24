import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';
import { normalizeState, normalizeZip4, normalizeZip5, isValidDateStr, isValidState, isValidZip4, isValidZip5, isValidLatitude, isValidLongitude } from '../lib/validators';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import * as repo from '../repositories/addressesRepo';

export const allowedAddressStatuses = ['active', 'inactive', 'pending_verification'] as const;
export type AllowedStatus = typeof allowedAddressStatuses[number];

export type AddressCreateInput = {
  entityType: 'contact' | 'employee';
  entityId: string;
  role?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isPrimary?: boolean;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  county?: string | null;
  state: string;
  zipCode: string;
  zipPlus4?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  uspsStandardized?: string | null;
  rawInput?: string | null;
  verified?: boolean;
  verificationDate?: string | null;
  dataSource?: string | null;
  status?: AllowedStatus;
};

export type AddressPatchInput = Partial<Omit<AddressCreateInput, 'entityType' | 'entityId' | 'addressLine1' | 'city' | 'state' | 'zipCode'>> & {
  entityType?: 'contact' | 'employee';
  entityId?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

function coerceStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return String(v);
}

async function ensureEntityExists(db: Awaited<ReturnType<typeof getDatabase>>, entityType: string, entityId: string) {
  if (entityType === 'contact') {
    const exists = await db.select({ id: schema.contacts.id }).from(schema.contacts).where(eq(schema.contacts.id, entityId)).limit(1);
    if (exists.length === 0) throw new ValidationError('Contact not found');
  } else if (entityType === 'employee') {
    const exists = await db.select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, entityId)).limit(1);
    if (exists.length === 0) throw new ValidationError('Employee not found');
  } else {
    throw new ValidationError('entityType must be contact or employee (organization not enabled yet)');
  }
}

export async function list(params: { entityType?: string; entityId?: string; role?: string; status?: string; isPrimary?: boolean | null; q?: string }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  return repo.listAddresses(db, params);
}

export async function create(input: AddressCreateInput) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');

  const entityType = String(input.entityType || '').trim() as 'contact' | 'employee';
  const entityId = String(input.entityId || '').trim();
  if (!entityType || !entityId) throw new ValidationError('entityType and entityId are required');
  await ensureEntityExists(db, entityType, entityId);

  const addressLine1 = String(input.addressLine1 || '').trim();
  const city = String(input.city || '').trim();
  const state = normalizeState(input.state);
  const zipCode = normalizeZip5(input.zipCode);
  const zipPlus4 = normalizeZip4(input.zipPlus4);

  if (!addressLine1) throw new ValidationError('addressLine1 is required');
  if (!city) throw new ValidationError('city is required');
  if (!(state && isValidState(state))) throw new ValidationError('state must be 2-letter uppercase');
  if (!(zipCode && isValidZip5(zipCode))) throw new ValidationError('zipCode must be 5 digits');
  if (!isValidZip4(zipPlus4)) throw new ValidationError('zipPlus4 must be 4 digits');

  if (!isValidLatitude(input.latitude)) throw new ValidationError('latitude must be between -90 and 90');
  if (!isValidLongitude(input.longitude)) throw new ValidationError('longitude must be between -180 and 180');

  const validFrom = typeof input.validFrom === 'string' ? input.validFrom.trim() : null;
  const validTo = typeof input.validTo === 'string' ? input.validTo.trim() : null;
  if (validFrom && !isValidDateStr(validFrom)) throw new ValidationError('invalid validFrom YYYY-MM-DD');
  if (validTo && !isValidDateStr(validTo)) throw new ValidationError('invalid validTo YYYY-MM-DD');
  if (validFrom && validTo && !(validFrom <= validTo)) throw new ValidationError('validFrom must be <= validTo');

  // ID generation
  let id: string | undefined;
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
  if (!id) {
    try { const nodeCrypto = await import('node:crypto'); if (nodeCrypto.randomUUID) id = nodeCrypto.randomUUID(); } catch {}
  }
  if (!id) id = `addr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const rawStatus = typeof input.status === 'string' ? input.status.trim() : '';
  const status = (rawStatus || 'active') as AllowedStatus;
  if (!allowedAddressStatuses.includes(status)) throw new ValidationError('invalid status');

  const record: repo.NewAddressRecord = {
    id,
    entityType,
    entityId,
    role: coerceStringOrNull(input.role),
    validFrom: validFrom as any,
    validTo: validTo as any,
    isPrimary: Boolean(input.isPrimary),
    addressLine1,
    addressLine2: coerceStringOrNull(input.addressLine2),
    city,
    county: coerceStringOrNull(input.county),
    state: String(state),
    zipCode: String(zipCode),
    zipPlus4: zipPlus4,
    latitude: input.latitude == null || String(input.latitude).trim() === '' ? null : String(Number(input.latitude)) as any,
    longitude: input.longitude == null || String(input.longitude).trim() === '' ? null : String(Number(input.longitude)) as any,
    uspsStandardized: coerceStringOrNull(input.uspsStandardized),
    rawInput: coerceStringOrNull(input.rawInput),
    verified: Boolean(input.verified),
    verificationDate: typeof input.verificationDate === 'string' ? input.verificationDate.trim() : null,
    dataSource: (typeof input.dataSource === 'string' && input.dataSource.trim()) || 'manual',
    status,
  } as any;

  try {
    return await repo.insertAddress(db, record);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('uniq_addresses_primary_per_role')) throw new ConflictError('PrimaryExists');
    throw e;
  }
}

export async function get(addressId: string) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const row = await repo.getAddressById(db, addressId);
  if (!row) throw new NotFoundError('Not found');
  return row;
}

export async function patch(addressId: string, body: AddressPatchInput) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');

  const patch: any = {};
  const s = (v: unknown) => (v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : String(v)));

  if (body.entityType !== undefined) {
    const entityType = String(body.entityType || '').trim();
    if (!['contact', 'employee'].includes(entityType)) throw new ValidationError('entityType must be contact or employee (organization not enabled yet)');
    patch.entityType = entityType;
  }
  if (body.entityId !== undefined) patch.entityId = String(body.entityId || '').trim();
  if (body.role !== undefined) patch.role = s(body.role);
  if (body.validFrom !== undefined) {
    if (body.validFrom != null && !isValidDateStr(body.validFrom)) throw new ValidationError('invalid validFrom');
    patch.validFrom = body.validFrom == null ? null : String(body.validFrom).trim();
  }
  if (body.validTo !== undefined) {
    if (body.validTo != null && !isValidDateStr(body.validTo)) throw new ValidationError('invalid validTo');
    patch.validTo = body.validTo == null ? null : String(body.validTo).trim();
  }
  if (body.isPrimary !== undefined) patch.isPrimary = Boolean(body.isPrimary);
  if (body.addressLine1 !== undefined) patch.addressLine1 = String(body.addressLine1 || '').trim() || null;
  if (body.addressLine2 !== undefined) patch.addressLine2 = s(body.addressLine2);
  if (body.city !== undefined) patch.city = String(body.city || '').trim() || null;
  if (body.county !== undefined) patch.county = s(body.county);
  if (body.state !== undefined) {
    if (!isValidState(body.state)) throw new ValidationError('state must be 2-letter uppercase');
    patch.state = normalizeState(body.state);
  }
  if (body.zipCode !== undefined) {
    const z5 = normalizeZip5(body.zipCode);
    if (!isValidZip5(z5)) throw new ValidationError('zipCode must be 5 digits');
    patch.zipCode = z5;
  }
  if (body.zipPlus4 !== undefined) {
    const z4 = normalizeZip4(body.zipPlus4);
    if (!isValidZip4(z4)) throw new ValidationError('zipPlus4 must be 4 digits');
    patch.zipPlus4 = z4;
  }
  if (body.latitude !== undefined) {
    if (!isValidLatitude(body.latitude)) throw new ValidationError('latitude must be between -90 and 90');
    patch.latitude = body.latitude == null || String(body.latitude).trim() === '' ? null : String(Number(body.latitude));
  }
  if (body.longitude !== undefined) {
    if (!isValidLongitude(body.longitude)) throw new ValidationError('longitude must be between -180 and 180');
    patch.longitude = body.longitude == null || String(body.longitude).trim() === '' ? null : String(Number(body.longitude));
  }
  if (body.uspsStandardized !== undefined) patch.uspsStandardized = s(body.uspsStandardized);
  if (body.rawInput !== undefined) patch.rawInput = s(body.rawInput);
  if (body.verified !== undefined) patch.verified = Boolean(body.verified);
  if (body.verificationDate !== undefined) {
    if (body.verificationDate != null && !isValidDateStr(body.verificationDate)) throw new ValidationError('invalid verificationDate');
    patch.verificationDate = body.verificationDate == null ? null : String(body.verificationDate).trim();
  }
  if (body.dataSource !== undefined) patch.dataSource = (typeof body.dataSource === 'string' ? body.dataSource.trim() : '') || 'manual';
  if (body.status !== undefined) {
    const nextStatus = (typeof body.status === 'string' ? body.status.trim() : '') || 'active';
    if (!allowedAddressStatuses.includes(nextStatus as any)) throw new ValidationError('invalid status');
    patch.status = nextStatus;
  }
  patch.updatedAt = new Date();

  if ('entityType' in patch || 'entityId' in patch) {
    const current = await repo.getAddressById(db, addressId);
    if (!current) throw new NotFoundError('Not found');
    const nextType = patch.entityType ?? (current as any).entityType;
    const nextId = patch.entityId ?? (current as any).entityId;
    await ensureEntityExists(db, nextType, nextId);
  }

  // Enforce validFrom <= validTo when either changes
  if (body.validFrom !== undefined || body.validTo !== undefined) {
    const current = await repo.getAddressById(db, addressId);
    if (!current) throw new NotFoundError('Not found');
    const nextFrom = Object.prototype.hasOwnProperty.call(patch, 'validFrom') ? patch.validFrom : (current as any).validFrom;
    const nextTo = Object.prototype.hasOwnProperty.call(patch, 'validTo') ? patch.validTo : (current as any).validTo;
    if (nextFrom != null && nextTo != null && !(String(nextFrom) <= String(nextTo))) {
      throw new ValidationError('validFrom must be <= validTo');
    }
  }

  try {
    const updated = await repo.updateAddressById(db, addressId, patch);
    if (!updated) throw new NotFoundError('Not found');
    return updated;
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('uniq_addresses_primary_per_role')) throw new ConflictError('PrimaryExists');
    if (msg.includes('chk_valid_dates')) throw new ValidationError('validFrom must be <= validTo');
    throw e;
  }
}

export async function remove(addressId: string) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const ok = await repo.deleteAddressById(db, addressId);
  if (!ok) throw new NotFoundError('Not found');
  return true;
}


