import { Context } from 'hono';
import * as service from '../services/addressesService';
import { AppError } from '../errors';

export async function list(c: Context) {
  const entityType = c.req.query('entityType') || undefined;
  const entityId = c.req.query('entityId') || undefined;
  const role = c.req.query('role') || undefined;
  const status = c.req.query('status') || undefined;
  const isPrimaryParam = c.req.query('isPrimary');
  const q = c.req.query('q') || undefined;
  const isPrimary = isPrimaryParam == null ? undefined : isPrimaryParam === 'true';
  try {
    const rows = await service.list({ entityType, entityId, role, status, isPrimary: isPrimary as any, q });
    return c.json(rows);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function create(c: Context) {
  const body = await c.req.json();
  const payload = {
    entityType: String(body.entityType || '').trim(),
    entityId: String(body.entityId || '').trim(),
    role: body.role,
    validFrom: body.validFrom,
    validTo: body.validTo,
    isPrimary: Boolean(body.isPrimary),
    addressLine1: String(body.addressLine1 || body.address_line_1 || '').trim(),
    addressLine2: body.addressLine2 ?? body.address_line_2,
    city: String(body.city || '').trim(),
    county: body.county,
    state: body.state,
    zipCode: body.zipCode ?? body.zip_code,
    zipPlus4: body.zipPlus4 ?? body.zip_plus4,
    latitude: body.latitude,
    longitude: body.longitude,
    uspsStandardized: body.uspsStandardized,
    rawInput: body.rawInput,
    verified: Boolean(body.verified),
    verificationDate: body.verificationDate,
    dataSource: body.dataSource,
    status: body.status,
  } as const;

  try {
    const created = await service.create(payload as any);
    return c.json(created, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function get(c: Context) {
  const id = c.req.param('addressId');
  try {
    const row = await service.get(id);
    return c.json(row);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('addressId');
  const body = await c.req.json();
  const payload = {
    entityType: body.entityType,
    entityId: body.entityId,
    role: body.role,
    validFrom: body.validFrom,
    validTo: body.validTo,
    isPrimary: body.isPrimary,
    addressLine1: body.addressLine1 ?? body.address_line_1,
    addressLine2: body.addressLine2 ?? body.address_line_2,
    city: body.city,
    county: body.county,
    state: body.state,
    zipCode: body.zipCode ?? body.zip_code,
    zipPlus4: body.zipPlus4 ?? body.zip_plus4,
    latitude: body.latitude,
    longitude: body.longitude,
    uspsStandardized: body.uspsStandardized,
    rawInput: body.rawInput,
    verified: body.verified,
    verificationDate: body.verificationDate,
    dataSource: body.dataSource,
    status: body.status,
  } as const;
  try {
    const updated = await service.patch(id, payload as any);
    return c.json(updated);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('addressId');
  try {
    await service.remove(id);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: (err as AppError).message }, (err as AppError).status);
    throw err;
  }
}


