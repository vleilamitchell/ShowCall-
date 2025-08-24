import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'contacts-user', email: 'contacts@example.com', aud: PROJECT_ID });

describe('Contacts golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'contacts-user', email: 'contacts@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('CRUD contacts with validations', async () => {
    // Create
    const createRes = await app.request(`${BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstName: 'Taylor',
        lastName: 'Stage',
        email: 'taylor@example.com',
        state: 'CA',
        postalCode: '94105',
        contactNumber: '5558675309',
        organization: 'Showcall Co',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Get
    const getRes = await app.request(`${BASE}/contacts/${created.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.email).toBe('taylor@example.com');

    // List with q
    const listRes = await app.request(`${BASE}/contacts?q=Showcall`, { headers: { Authorization: `Bearer ${token}` } });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((c: any) => c.id === created.id)).toBe(true);

    // Patch validations and update
    const badPatch = await app.request(`${BASE}/contacts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postalCode: '123' }),
    });
    expect(badPatch.status).toBe(400);

    const patchRes = await app.request(`${BASE}/contacts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ organization: 'Showcall Inc', contactNumber: '4155551234' }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.organization).toBe('Showcall Inc');

    // Delete
    const delRes = await app.request(`${BASE}/contacts/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(delRes.status).toBe(204);

    const get404 = await app.request(`${BASE}/contacts/${created.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(get404.status).toBe(404);
  });
});


