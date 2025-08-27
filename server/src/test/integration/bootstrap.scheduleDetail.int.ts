import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { resetTestDatabase, truncateAllTables } from '../testDb';
import * as schema from '../../schema';
import { getDatabase } from '../../lib/db';

const BASE = '/api/v1/bootstrap';
const DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  throw new Error('DATABASE_URL_TEST (or DATABASE_URL) must be set for integration tests');
}
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'sched-user', email: 'sched@example.com', aud: PROJECT_ID });

describe('bootstrap.schedule-detail', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    await resetTestDatabase(DB_URL);
    app = buildTestApp({ stubAuth: { userId: 'sched-user', email: 'sched@example.com' } });
  });

  beforeEach(async () => {
    await truncateAllTables(DB_URL);
  });

  it('400 without scheduleId', async () => {
    const resp = await app.request(`${BASE}/schedule-detail`, { headers: { Authorization: `Bearer ${token}` } });
    expect(resp.status).toBe(400);
  });

  it('404 for unknown scheduleId', async () => {
    const resp = await app.request(`${BASE}/schedule-detail?scheduleId=unknown`, { headers: { Authorization: `Bearer ${token}` } });
    expect(resp.status).toBe(404);
  });

  it('returns aggregated payload and respects departmentId filter', async () => {
    const db = await getDatabase();
    // Seed minimal data: 2 depts, 1 event, 1 schedule, 3 shifts (2 in dept A, 1 in dept B), assignments, positions, employees, areas
    const deptA = (await (db as any).insert((schema as any).departments).values({ id: 'deptA', name: 'Dept A' }).returning())[0];
    const deptB = (await (db as any).insert((schema as any).departments).values({ id: 'deptB', name: 'Dept B' }).returning())[0];
    const event = (await (db as any).insert((schema as any).events).values({ id: 'evt1', title: 'Show', status: 'planned', date: '2025-07-01', startTime: '10:00', endTime: '22:00' }).returning())[0];
    const area1 = (await (db as any).insert((schema as any).areas).values({ id: 'area1', name: 'Stage' }).returning())[0];
    const area2 = (await (db as any).insert((schema as any).areas).values({ id: 'area2', name: 'FOH' }).returning())[0];
    await (db as any).insert((schema as any).eventAreas).values([{ eventId: event.id, areaId: area1.id }, { eventId: event.id, areaId: area2.id }]);
    const sched = (await (db as any).insert((schema as any).schedules).values({ id: 'sched1', name: 'July', startDate: '2025-07-01', endDate: '2025-07-31', isPublished: false }).returning())[0];
    const posA = (await (db as any).insert((schema as any).positions).values({ id: 'posA', departmentId: deptA.id, name: 'Loader' }).returning())[0];
    const posB = (await (db as any).insert((schema as any).positions).values({ id: 'posB', departmentId: deptB.id, name: 'Runner' }).returning())[0];
    const empA = (await (db as any).insert((schema as any).employees).values({ id: 'empA', departmentId: deptA.id, name: 'Alice' }).returning())[0];
    const empB = (await (db as any).insert((schema as any).employees).values({ id: 'empB', departmentId: deptB.id, name: 'Bob' }).returning())[0];
    const sh1 = (await (db as any).insert((schema as any).shifts).values({ id: 'sh1', departmentId: deptA.id, scheduleId: sched.id, date: '2025-07-02', startTime: '09:00', endTime: '12:00', eventId: event.id }).returning())[0];
    const sh2 = (await (db as any).insert((schema as any).shifts).values({ id: 'sh2', departmentId: deptA.id, scheduleId: sched.id, date: '2025-07-02', startTime: '13:00', endTime: '16:00', eventId: event.id }).returning())[0];
    const sh3 = (await (db as any).insert((schema as any).shifts).values({ id: 'sh3', departmentId: deptB.id, scheduleId: sched.id, date: '2025-07-03', startTime: '10:00', endTime: '14:00', eventId: event.id }).returning())[0];
    await (db as any).insert((schema as any).assignments).values([
      { id: 'asg1', departmentId: deptA.id, shiftId: sh1.id, requiredPositionId: posA.id, assigneeEmployeeId: empA.id, areaId: area1.id },
      { id: 'asg2', departmentId: deptB.id, shiftId: sh3.id, requiredPositionId: posB.id, assigneeEmployeeId: empB.id, areaId: area2.id },
    ]);

    // Unfiltered
    const r1 = await app.request(`${BASE}/schedule-detail?scheduleId=${sched.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r1.status).toBe(200);
    const body1 = await r1.json();
    expect(body1.schedule.id).toBe(sched.id);
    expect(body1.shifts.map((s: any) => s.id)).toEqual(['sh1', 'sh2', 'sh3']); // ordered by date, start
    expect(Array.isArray(body1.assignments)).toBe(true);
    expect(body1.employeesByDept[deptA.id].some((e: any) => e.id === empA.id)).toBe(true);
    expect(body1.positionsByDept[deptB.id].some((p: any) => p.id === posB.id)).toBe(true);
    expect(Array.isArray(body1.areasByEvent[event.id])).toBe(true);

    // Filtered by department A
    const r2 = await app.request(`${BASE}/schedule-detail?scheduleId=${sched.id}&departmentId=${deptA.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r2.status).toBe(200);
    const body2 = await r2.json();
    expect(body2.shifts.map((s: any) => s.id)).toEqual(['sh1', 'sh2']);
    expect(body2.employeesByDept[deptB.id]).toBeUndefined();
    const asgShiftIds = new Set((body2.assignments as any[]).map((a: any) => a.shiftId));
    expect(asgShiftIds.has('sh3')).toBe(false);
  });
});


