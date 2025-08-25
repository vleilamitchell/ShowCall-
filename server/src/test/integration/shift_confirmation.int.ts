import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const DB_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/postgres';
const BASE = '/api/v1';
const PROJECT_ID = 'showcall-local';
const token = makeEmulatorJwt({ sub: 'shift-conf-user', email: 'shiftconf@example.com', aud: PROJECT_ID });

describe('Shift confirmation aggregate', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'shift-conf-user', email: 'shiftconf@example.com' } });
  });

  afterEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('enforces all assignments confirmed before confirming shift', async () => {
    const d1 = await app.request(`${BASE}/departments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Ops' }) });
    const dept = await d1.json();
    const p1 = await app.request(`${BASE}/positions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: dept.id, title: 'Tech' }) });
    const position = await p1.json();
    const e1 = await app.request(`${BASE}/employees`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: dept.id, name: 'Chris' }) });
    const emp = await e1.json();
    const s1 = await app.request(`${BASE}/schedules`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Week 3', startDate: '2025-06-15', endDate: '2025-06-21' }) });
    const sched = await s1.json();
    const sh1 = await app.request(`${BASE}/departments/${dept.id}/shifts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ scheduleId: sched.id, date: '2025-06-16', startTime: '09:00', endTime: '17:00' }) });
    const shift = await sh1.json();
    const a1 = await app.request(`${BASE}/departments/${dept.id}/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ shiftId: shift.id, requiredPositionId: position.id, assigneeEmployeeId: emp.id }) });
    const asg1 = await a1.json();
    const a2 = await app.request(`${BASE}/departments/${dept.id}/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ shiftId: shift.id, requiredPositionId: position.id, assigneeEmployeeId: emp.id }) });
    const asg2 = await a2.json();

    await app.request(`${BASE}/schedules/${sched.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    // Confirm one assignment
    await app.request(`${BASE}/assignments/${asg1.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    // Try to confirm shift: should 409
    const c1 = await app.request(`${BASE}/shifts/${shift.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(c1.status).toBe(409);

    // Confirm second assignment
    await app.request(`${BASE}/assignments/${asg2.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    // Now confirm shift
    const c2 = await app.request(`${BASE}/shifts/${shift.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(c2.status).toBe(200);
    const updated = await c2.json();
    expect(updated.status).toBe('confirmed');

    // GET confirmation-state
    const st = await app.request(`${BASE}/shifts/${shift.id}/confirmation-state`, { headers: { Authorization: `Bearer ${token}` } });
    const state = await st.json();
    expect(state.isConfirmed).toBe(true);
  });
});


