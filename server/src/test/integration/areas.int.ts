import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'areas-user', email: 'areas@example.com', aud: PROJECT_ID });

describe('Areas golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'areas-user', email: 'areas@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('GET /areas requires auth', async () => {
    // Use an app without stub auth to verify 401
    const unauthApp = buildTestApp();
    const res = await unauthApp.request(`${BASE}/areas`);
    expect(res.status).toBe(401);
  });

  it('POST/GET/PATCH/DELETE areas happy path and ordering', async () => {
    // Create two areas
    const a1 = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Front of House', description: 'FOH', color: '#ff0000', active: true }),
    });
    expect(a1.status).toBe(201);
    const area1 = await a1.json();

    const a2 = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Backstage', description: 'BS', color: '#00ff00', active: true }),
    });
    expect(a2.status).toBe(201);
    const area2 = await a2.json();

    // List default order
    const list = await app.request(`${BASE}/areas`, { headers: { Authorization: `Bearer ${token}` } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(Array.isArray(rows)).toBe(true);

    // Reorder
    const reorder = await app.request(`${BASE}/areas/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [area2.id, area1.id] }),
    });
    expect(reorder.status).toBe(200);
    const reordered = await reorder.json();
    expect(reordered[0].id).toBe(area2.id);

    // Patch name and color
    const patch = await app.request(`${BASE}/areas/${area1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'FOH Updated', color: '#0000ff' }),
    });
    expect(patch.status).toBe(200);
    const updated = await patch.json();
    expect(updated.name).toBe('FOH Updated');
    expect(updated.color).toBe('#0000ff');

    // Delete second
    const del = await app.request(`${BASE}/areas/${area2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.status !== 204) {
      // eslint-disable-next-line no-console
      console.log('Delete area failed body:', await del.text());
    }
    expect(del.status).toBe(204);
  });

  it('Validates errors and conflict cases', async () => {
    // Invalid name
    const badName = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: '' }),
    });
    expect(badName.status).toBe(400);

    // Invalid color
    const badColor = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Valid', color: 'nope' }),
    });
    expect(badColor.status).toBe(400);

    // Unique name conflict
    const one = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Unique', color: '#111111' }),
    });
    expect(one.status).toBe(201);
    const conflict = await app.request(`${BASE}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Unique', color: '#111111' }),
    });
    expect(conflict.status).toBe(409);

    // Unknown ids on reorder
    const badReorder = await app.request(`${BASE}/areas/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: ['missing'] }),
    });
    expect(badReorder.status).toBe(400);
  });
});


