import { Context } from 'hono';
import * as service from '../services/contactsService';
import { isValidEmail, isValidPhone, isValidState, isValidZip5 } from '../lib/validators';

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const rows = await service.list({ q });
  return c.json(rows);
}

export async function create(c: Context) {
  const body = await c.req.json();
  if (!isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
  if (!isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
  if (!isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);
  if (body.contactNumber != null && !isValidPhone(body.contactNumber)) return c.json({ error: 'contactNumber must be at least 7 digits' }, 400);
  const created = await service.create(body);
  return c.json(created, 201);
}

export async function get(c: Context) {
  const id = c.req.param('contactId');
  try {
    const row = await service.get(id);
    return c.json(row);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function patch(c: Context) {
  const id = c.req.param('contactId');
  const body = await c.req.json();
  if ('email' in body && !isValidEmail(body.email)) return c.json({ error: 'invalid email format' }, 400);
  if ('state' in body && !isValidState(body.state)) return c.json({ error: 'state must be 2-letter uppercase' }, 400);
  if ('postalCode' in body && !isValidZip5(body.postalCode)) return c.json({ error: 'postalCode must be 5 digits' }, 400);
  if ('contactNumber' in body && !isValidPhone(body.contactNumber)) return c.json({ error: 'contactNumber must be at least 7 digits' }, 400);
  try {
    const updated = await service.patch(id, body);
    return c.json(updated);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}

export async function remove(c: Context) {
  const id = c.req.param('contactId');
  try {
    await service.remove(id);
    return c.body(null, 204);
  } catch (e: any) {
    if (String(e?.code) === 'NotFound') return c.json({ error: 'Not found' }, 404);
    throw e;
  }
}


