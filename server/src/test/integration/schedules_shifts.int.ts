import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'sched-user', email: 'sched@example.com', aud: PROJECT_ID });

describe('Schedules & Shifts golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'sched-user', email: 'sched@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('Schedule CRUD and publish/unpublish', async () => {
    // Create schedule
    const create = await app.request(`${BASE}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Summer', startDate: '2025-06-01', endDate: '2025-06-30' }),
    });
    expect(create.status).toBe(200);
    const sched = await create.json();

    // Get
    const get = await app.request(`${BASE}/schedules/${sched.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(get.status).toBe(200);

    // Patch
    const patch = await app.request(`${BASE}/schedules/${sched.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Summer Updated' }),
    });
    expect(patch.status).toBe(200);
    const updated = await patch.json();
    expect(updated.name).toBe('Summer Updated');

    // Publish
    const pub = await app.request(`${BASE}/schedules/${sched.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(pub.status).toBe(200);
    const published = await pub.json();
    expect(published.isPublished).toBe(true);

    // Unpublish
    const unpub = await app.request(`${BASE}/schedules/${sched.id}/unpublish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(unpub.status).toBe(200);
    const un = await unpub.json();
    expect(un.isPublished).toBe(false);

    // List with filters
    const list = await app.request(`${BASE}/schedules?q=Summer&from=2025-05-01&to=2025-07-01`, { headers: { Authorization: `Bearer ${token}` } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(Array.isArray(rows)).toBe(true);
  });

  it('Shifts CRUD and list by department with filters', async () => {
    // Create a department
    const dep = await app.request(`${BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Ops' }),
    });
    expect([200, 201]).toContain(dep.status);
    const dept = await dep.json();

    // Create a shift
    const s1 = await app.request(`${BASE}/departments/${dept.id}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: '2025-06-05', startTime: '10:00', endTime: '14:00', title: 'Load In' }),
    });
    expect(s1.status).toBe(201);
    const shift = await s1.json();

    // Get
    const g1 = await app.request(`${BASE}/shifts/${shift.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(g1.status).toBe(200);

    // Patch
    const p1 = await app.request(`${BASE}/shifts/${shift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Load In (Updated)' }),
    });
    expect(p1.status).toBe(200);

    // List by dept
    const l1 = await app.request(`${BASE}/departments/${dept.id}/shifts?from=2025-06-01&to=2025-06-30`, { headers: { Authorization: `Bearer ${token}` } });
    expect(l1.status).toBe(200);
    const rows = await l1.json();
    expect(rows.some((r: any) => r.id === shift.id)).toBe(true);

    // Delete
    const d1 = await app.request(`${BASE}/shifts/${shift.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(d1.status).toBe(204);
  });
});
