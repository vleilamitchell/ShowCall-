import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const BASE = '/api/v1';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'emp-dept-change', email: 'emp-dept@example.com', aud: PROJECT_ID });

describe('Employee department change cleans up employee_positions', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'emp-dept-change', email: 'emp-dept@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('moves employee to another department and removes cross-dept employee_positions', async () => {
    // Create Dept A and Dept B
    const depARes = await app.request(`${BASE}/departments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Dept A' }),
    });
    expect([200,201]).toContain(depARes.status);
    const deptA = await depARes.json();

    const depBRes = await app.request(`${BASE}/departments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Dept B' }),
    });
    expect([200,201]).toContain(depBRes.status);
    const deptB = await depBRes.json();

    // Create employee in Dept A
    const eRes = await app.request(`${BASE}/departments/${deptA.id}/employees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Mover' }),
    });
    expect(eRes.status).toBe(200);
    const emp = await eRes.json();

    // Create position in Dept A and link employee
    const pRes = await app.request(`${BASE}/departments/${deptA.id}/positions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Role A' }),
    });
    expect(pRes.status).toBe(200);
    const posA = await pRes.json();

    const epRes = await app.request(`${BASE}/employee-positions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: deptA.id, employeeId: emp.id, positionId: posA.id, priority: 1 }),
    });
    expect(epRes.status).toBe(200);

    // Move employee to Dept B
    const patchRes = await app.request(`${BASE}/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: deptB.id }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.departmentId).toBe(deptB.id);

    // Verify Dept A employee-positions no longer contain this employee
    const listEpA = await app.request(`${BASE}/departments/${deptA.id}/employee-positions`, { headers: { Authorization: `Bearer ${token}` } });
    expect(listEpA.status).toBe(200);
    const rowsA = await listEpA.json();
    expect(Array.isArray(rowsA)).toBe(true);
    expect(rowsA.some((r: any) => r.employeeId === emp.id)).toBe(false);
  });
});


