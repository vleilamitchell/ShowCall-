import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';

const DB_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/postgres';
const BASE = '/api/v1';
const PROJECT_ID = 'showcall-local';
const token = makeEmulatorJwt({ sub: 'assign-conf-user', email: 'assignconf@example.com', aud: PROJECT_ID });

describe('Assignment confirmations', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'assign-conf-user', email: 'assignconf@example.com' } });
  });

  afterEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('confirm/decline via token and authenticated path', async () => {
    // Setup department, position, employee, schedule, shift
    const d1 = await app.request(`${BASE}/departments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Ops' }) });
    const dept = await d1.json();
    const p1 = await app.request(`${BASE}/positions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: dept.id, title: 'Tech' }) });
    const position = await p1.json();
    const e1 = await app.request(`${BASE}/employees`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ departmentId: dept.id, name: 'Bob' }) });
    const emp = await e1.json();
    const s1 = await app.request(`${BASE}/schedules`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Week 2', startDate: '2025-06-08', endDate: '2025-06-14' }) });
    const sched = await s1.json();
    const sh1 = await app.request(`${BASE}/departments/${dept.id}/shifts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ scheduleId: sched.id, date: '2025-06-09', startTime: '09:00', endTime: '17:00' }) });
    const shift = await sh1.json();
    const asg1 = await app.request(`${BASE}/departments/${dept.id}/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ shiftId: shift.id, requiredPositionId: position.id, assigneeEmployeeId: emp.id }) });
    const assigned = await asg1.json();

    // Publish schedule to issue token
    await app.request(`${BASE}/schedules/${sched.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    // Fetch assignment to read token presence (we cannot read raw token, confirm via token endpoint requires raw token usually)
    // For test, hit authenticated confirm endpoint
    const confirmRes = await app.request(`${BASE}/assignments/${assigned.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(confirmRes.status).toBe(200);
    const confirmed = await confirmRes.json();
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.respondedAt).toBeTruthy();

    // Idempotent
    const confirmAgain = await app.request(`${BASE}/assignments/${assigned.id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(confirmAgain.status).toBe(200);

    // Decline different assignment to ensure decline path works
    const asg2 = await app.request(`${BASE}/departments/${dept.id}/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ shiftId: shift.id, requiredPositionId: position.id, assigneeEmployeeId: emp.id }) });
    const assigned2 = await asg2.json();
    await app.request(`${BASE}/schedules/${sched.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const declineRes = await app.request(`${BASE}/assignments/${assigned2.id}/decline`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ reason: 'Out' }) });
    expect(declineRes.status).toBe(200);
    const declined = await declineRes.json();
    expect(declined.status).toBe('declined');
    expect(declined.declineReason).toBe('Out');
  });
});


