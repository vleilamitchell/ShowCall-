import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'emp-pos-user', email: 'emp-pos@example.com', aud: PROJECT_ID });

describe('Employees & Positions golden-master', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'emp-pos-user', email: 'emp-pos@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('CRUD employees and positions, linking via employee-positions and eligible listing', async () => {
    // Create a department to scope employees/positions
    const depRes = await app.request(`${BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Ops', description: 'Operations' }),
    });
    expect([200,201]).toContain(depRes.status);
    const dept = await depRes.json();

    // Create employees (one with name, one with first+last)
    const e1Res = await app.request(`${BASE}/departments/${dept.id}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Alex Tech', email: 'alex@example.com', primaryPhone: '5551234567' }),
    });
    expect(e1Res.status).toBe(200);
    const emp1 = await e1Res.json();

    const e2Res = await app.request(`${BASE}/departments/${dept.id}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ firstName: 'Bella', lastName: 'Crew', email: 'bella@example.com', primaryPhone: '5551112222' }),
    });
    expect(e2Res.status).toBe(200);
    const emp2 = await e2Res.json();

    // List employees and ensure fullName is present
    const elist = await app.request(`${BASE}/departments/${dept.id}/employees`, { headers: { Authorization: `Bearer ${token}` } });
    expect(elist.status).toBe(200);
    const employees = await elist.json();
    expect(employees.some((e: any) => e.id === emp1.id && typeof e.fullName === 'string')).toBe(true);
    expect(employees.some((e: any) => e.id === emp2.id && typeof e.fullName === 'string')).toBe(true);

    // Create a position
    const p1Res = await app.request(`${BASE}/departments/${dept.id}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Rigger' }),
    });
    expect(p1Res.status).toBe(200);
    const pos1 = await p1Res.json();

    // List positions with q filter
    const plist = await app.request(`${BASE}/departments/${dept.id}/positions?q=Rig`, { headers: { Authorization: `Bearer ${token}` } });
    expect(plist.status).toBe(200);
    const positions = await plist.json();
    expect(positions.some((p: any) => p.id === pos1.id)).toBe(true);

    // Link employees to position
    const ep1 = await app.request(`${BASE}/employee-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ departmentId: dept.id, employeeId: emp1.id, positionId: pos1.id, priority: 10, isLead: false }),
    });
    expect(ep1.status).toBe(200);
    const epRec1 = await ep1.json();

    const ep2 = await app.request(`${BASE}/employee-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ departmentId: dept.id, employeeId: emp2.id, positionId: pos1.id, priority: 5, isLead: true }),
    });
    expect(ep2.status).toBe(200);
    const epRec2 = await ep2.json();

    // Eligible listing sorted by priority desc then name
    const elig = await app.request(`${BASE}/departments/${dept.id}/positions/${pos1.id}/eligible`, { headers: { Authorization: `Bearer ${token}` } });
    expect(elig.status).toBe(200);
    const eligible = await elig.json();
    expect(Array.isArray(eligible)).toBe(true);
    expect(eligible[0].id).toBe(emp1.id); // higher priority

    // Batch update employee-positions priorities
    const batch = await app.request(`${BASE}/positions/${pos1.id}/employee-positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: [ { id: epRec1.id, priority: 1 }, { id: epRec2.id, priority: 20, isLead: false } ] }),
    });
    expect(batch.status).toBe(200);
    const batchUpdated = await batch.json();
    expect(batchUpdated.some((i: any) => i.id === epRec2.id && i.priority === 20 && i.isLead === false)).toBe(true);

    // Patch employee partial data (email)
    const patchEmp = await app.request(`${BASE}/employees/${emp1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: 'alex.t@example.com' }),
    });
    expect(patchEmp.status).toBe(200);
    const emp1Updated = await patchEmp.json();
    expect(emp1Updated.email).toBe('alex.t@example.com');

    // Delete employee
    const delEmp = await app.request(`${BASE}/employees/${emp2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delEmp.status).toBe(204);
  });
});
