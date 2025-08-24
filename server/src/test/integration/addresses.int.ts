import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'addr-user', email: 'addr@example.com', aud: PROJECT_ID });

describe('Addresses golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp();
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('GET /addresses requires auth', async () => {
    const res = await app.request(`${BASE}/addresses`);
    expect(res.status).toBe(401);
  });

  it('POST /addresses validates missing fields', async () => {
    const res = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('POST/GET/PATCH address happy path', async () => {
    // First create a minimal contact to satisfy entity checks
    const contactCreate = await app.request(`${BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstName: 'A',
        lastName: 'B',
        city: 'X',
        state: 'NY',
        postalCode: '10001',
        email: 'a@b.com',
        contactNumber: '2125551234',
      }),
    });
    expect(contactCreate.status).toBe(201);
    const createdContact = await contactCreate.json();
    const contactId = createdContact.id as string;

    const createRes = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        entityType: 'contact',
        entityId: contactId,
        addressLine1: '1 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        isPrimary: true,
      }),
    });
    const created = await createRes.json();
    if (createRes.status !== 201) {
      // help debug current monolith behavior
      // eslint-disable-next-line no-console
      console.log('Create address failed body:', created);
    }
    expect(createRes.status).toBe(201);
    expect(created).toHaveProperty('id');
    const id = created.id as string;

    const getRes = await app.request(`${BASE}/addresses/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched).toHaveProperty('addressLine1', '1 Main St');
    expect(fetched).toHaveProperty('state', 'NY');

    const patchRes = await app.request(`${BASE}/addresses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ city: 'Brooklyn' }),
    });
    if (patchRes.status !== 200) {
      // eslint-disable-next-line no-console
      console.log('Patch address failed body:', await patchRes.json());
    }
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched).toHaveProperty('city', 'Brooklyn');
  });

  it('Lists addresses with filters and ordering', async () => {
    const contactCreate = await app.request(`${BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ firstName: 'C', lastName: 'D', city: 'X', state: 'NY', postalCode: '10001', email: 'c@d.com', contactNumber: '2125559999' }),
    });
    expect(contactCreate.status).toBe(201);
    const { id: contactId } = await contactCreate.json();

    // Create two addresses; one primary, one not
    const a1 = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, addressLine1: '9 North', city: 'New York', state: 'NY', zipCode: '10001', isPrimary: true, role: 'home' }),
    });
    expect(a1.status).toBe(201);
    const a2 = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, addressLine1: '2 South', city: 'Albany', state: 'NY', zipCode: '12207', isPrimary: false, role: 'work' }),
    });
    expect(a2.status).toBe(201);

    const listAll = await app.request(`${BASE}/addresses?entityType=contact&entityId=${contactId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listAll.status).toBe(200);
    const rows = await listAll.json();
    expect(Array.isArray(rows)).toBe(true);
    // Primary should come first per ordering
    expect(rows[0]).toHaveProperty('isPrimary', true);

    const filterRole = await app.request(`${BASE}/addresses?entityType=contact&entityId=${contactId}&role=work`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(filterRole.status).toBe(200);
    const rowsRole = await filterRole.json();
    expect(rowsRole.length).toBe(1);
    expect(rowsRole[0]).toHaveProperty('role', 'work');

    const qSearch = await app.request(`${BASE}/addresses?q=South`, { headers: { Authorization: `Bearer ${token}` } });
    expect(qSearch.status).toBe(200);
    const rowsQ = await qSearch.json();
    expect(rowsQ.some((r: any) => r.addressLine1.includes('South'))).toBe(true);
  });

  it('Validates errors and conflict cases', async () => {
    const contactCreate = await app.request(`${BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ firstName: 'E', lastName: 'F', city: 'X', state: 'NY', postalCode: '10001', email: 'e@f.com', contactNumber: '2125552222' }),
    });
    expect(contactCreate.status).toBe(201);
    const { id: contactId } = await contactCreate.json();

    // Invalid state
    const badState = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, addressLine1: '1 Main', city: 'NY', state: 'N', zipCode: '10001' }),
    });
    expect(badState.status).toBe(400);
    const badStateBody = await badState.json();
    expect(badStateBody).toHaveProperty('error');

    // Date ordering violation
    const badDates = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, addressLine1: '2 Main', city: 'NY', state: 'NY', zipCode: '10001', validFrom: '2024-12-31', validTo: '2024-01-01' }),
    });
    expect(badDates.status).toBe(400);

    // Primary-per-role conflict
    const firstPrimary = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, role: 'home', addressLine1: '3 Main', city: 'NY', state: 'NY', zipCode: '10001', isPrimary: true }),
    });
    expect(firstPrimary.status).toBe(201);
    const conflict = await app.request(`${BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType: 'contact', entityId: contactId, role: 'home', addressLine1: '4 Main', city: 'NY', state: 'NY', zipCode: '10001', isPrimary: true }),
    });
    expect(conflict.status).toBe(409);
    const conflictBody = await conflict.json();
    expect(conflictBody).toHaveProperty('error');

    // Not found
    const missing = await app.request(`${BASE}/addresses/nonexistent`, { headers: { Authorization: `Bearer ${token}` } });
    expect(missing.status).toBe(404);
  });
});


