import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'assign-user', email: 'assign@example.com', aud: PROJECT_ID });

describe('Assignments golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'assign-user', email: 'assign@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('Create/list/patch/delete assignment', async () => {
    // Department
    const dep = await app.request(`${BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Ops' }),
    });
    const dept = await dep.json();

    // Position
    const pos = await app.request(`${BASE}/departments/${dept.id}/positions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Rigger' }),
    });
    const position = await pos.json();

    // Shift
    const s1 = await app.request(`${BASE}/departments/${dept.id}/shifts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: '2025-06-05', startTime: '10:00', endTime: '14:00', title: 'Load In' }),
    });
    const shift = await s1.json();

    // Create assignment
    const a1 = await app.request(`${BASE}/departments/${dept.id}/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shiftId: shift.id, requiredPositionId: position.id }),
    });
    expect(a1.status).toBe(200);
    const asg = await a1.json();

    // List assignments
    const list = await app.request(`${BASE}/departments/${dept.id}/assignments?shiftId=${shift.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows.some((r: any) => r.id === asg.id)).toBe(true);

    // Patch assignee
    const emp = await app.request(`${BASE}/departments/${dept.id}/employees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Alex Tech', email: 'alex@example.com', primaryPhone: '5551234567' }),
    });
    const employee = await emp.json();

    const p1 = await app.request(`${BASE}/assignments/${asg.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assigneeEmployeeId: employee.id }),
    });
    expect(p1.status).toBe(200);
    const updated = await p1.json();
    expect(updated.assigneeEmployeeId).toBe(employee.id);

    // Delete
    const d1 = await app.request(`${BASE}/assignments/${asg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(d1.status).toBe(204);
  });
});
