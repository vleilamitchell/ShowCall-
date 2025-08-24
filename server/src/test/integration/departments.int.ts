import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';

describe('Departments golden-master', () => {
  let app: any;
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
  const token = makeEmulatorJwt({ sub: 'dept-user', email: 'dept@example.com', aud: PROJECT_ID });

  beforeAll(async () => {
    const conn = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5502/postgres';
    await resetTestDatabase(conn);
    await truncateAllTables(conn);
    app = buildTestApp({ stubAuth: { userId: 'u1', email: 'u1@example.com' } });
  });

  beforeEach(async () => {
    const conn = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5502/postgres';
    await truncateAllTables(conn);
  });

  it('CRUD and list with q filter', async () => {
    // Create
    const create = await app.request(`${BASE}/departments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Lighting', description: 'LX' }),
    });
    expect([200,201]).toContain(create.status);
    const dep = await create.json();
    if (!dep?.id) {
      // eslint-disable-next-line no-console
      console.log('Create department body:', dep);
    }
    const id = dep.id;

    // Get
    const get = await app.request(`${BASE}/departments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(get.status).toBe(200);
    const got = await get.json();
    expect(got.name).toBe('Lighting');

    // Patch
    const patch = await app.request(`${BASE}/departments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: 'Lighting Dept' }),
    });
    expect(patch.status).toBe(200);
    const updated = await patch.json();
    expect(updated.description).toBe('Lighting Dept');

    // List and filter
    const list = await app.request(`${BASE}/departments?q=Light`, { headers: { Authorization: `Bearer ${token}` } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows.some((r: any) => r.id === id)).toBe(true);
  });
});


