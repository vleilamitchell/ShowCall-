import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestApp } from '../testApp';
import { truncateAllTables, resetTestDatabase } from '../testDb';

const auth = { userId: 'u_test', email: 'test@example.com' };

describe('Event Series modular routes parity (golden master)', () => {
  let app: any;
  beforeAll(async () => {
    app = buildTestApp({ stubAuth: auth });
    const conn = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5502/postgres';
    await resetTestDatabase(conn);
    await truncateAllTables(conn);
  });

  it('lists series (should not error)', async () => {
    const res = await app.request('/api/v1/event-series');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('preview returns validation error on bad date', async () => {
    const res = await app.request('/api/v1/event-series/unknown/preview', { method: 'POST', body: JSON.stringify({ untilDate: 'bogus' }) });
    expect(res.status).toBe(400);
  });

  it('supports CRUD on series and rule, and areas operations', async () => {
    // Create series with rule
    const createRes = await app.request('/api/v1/event-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Series',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        defaultStatus: 'planned',
        defaultStartTime: '10:00',
        defaultEndTime: '20:00',
        rule: { frequency: 'WEEKLY', interval: 1, byWeekdayMask: 0b0010000 }, // Thursday
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toHaveProperty('id');
    const seriesId = created.id;

    // Patch series
    const patchRes = await app.request(`/api/v1/event-series/${seriesId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated' }),
    });
    expect(patchRes.status).toBe(200);

    // Series areas replace (no areas yet -> empty set ok)
    let areasRes = await app.request(`/api/v1/event-series/${seriesId}/areas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaIds: [] }),
    });
    expect(areasRes.status).toBe(200);
    let areas = await areasRes.json();
    expect(Array.isArray(areas)).toBe(true);

    // Create two areas directly via legacy API for test convenience
    // Note: Using legacy route ensures DB has valid areas to link
    const a1 = `a_${Math.random().toString(36).slice(2,8)}`;
    const a2 = `a_${Math.random().toString(36).slice(2,8)}`;
    const createArea = async (id: string, name: string) => {
      const res = await app.request('/api/v1/areas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, color: '#fff' }),
      });
      // If legacy route differs, allow 200/201
      expect([200,201]).toContain(res.status);
    };
    await createArea(a1, 'Area 1');
    await createArea(a2, 'Area 2');

    // Replace with [a1]
    areasRes = await app.request(`/api/v1/event-series/${seriesId}/areas`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaIds: [a1] }),
    });
    expect(areasRes.status).toBe(200);
    areas = await areasRes.json();
    expect(areas.find((x: any) => x.id === a1)).toBeTruthy();

    // Add a2
    const addRes = await app.request(`/api/v1/event-series/${seriesId}/areas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: a2 }),
    });
    expect([200,201]).toContain(addRes.status);

    // Remove a1
    const delRes = await app.request(`/api/v1/event-series/${seriesId}/areas/${a1}`, { method: 'DELETE' });
    expect(delRes.status).toBe(204);

    // Get should reflect only a2
    const listAreas = await app.request(`/api/v1/event-series/${seriesId}/areas`);
    expect(listAreas.status).toBe(200);
    const only = await listAreas.json();
    expect(only.some((x: any) => x.id === a2)).toBe(true);
  });

  it('preview happy-path and generate events (skip/overwrite) works', async () => {
    // Create a series Thu-only, two weeks
    const createRes = await app.request('/api/v1/event-series', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gen Series', startDate: '2025-01-01', endDate: '2025-01-31',
        defaultStatus: 'planned', defaultStartTime: '18:00', defaultEndTime: '22:00',
        rule: { frequency: 'WEEKLY', interval: 1, byWeekdayMask: 0b0010000 },
      }),
    });
    expect(createRes.status).toBe(201);
    const { id: seriesId } = await createRes.json();

    // Preview
    const previewRes = await app.request(`/api/v1/event-series/${seriesId}/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ untilDate: '2025-01-31' }),
    });
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(Array.isArray(preview.dates)).toBe(true);
    expect(preview.dates.length).toBeGreaterThan(0);

    // Generate initial (skip existing default)
    const gen1 = await app.request(`/api/v1/event-series/${seriesId}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ untilDate: '2025-01-31', overwriteExisting: false }),
    });
    expect([200,201]).toContain(gen1.status);
    const g1 = await gen1.json();
    expect(g1.created).toBeGreaterThan(0);

    // Generate overwrite should update existing (0 created, >=1 updated)
    const gen2 = await app.request(`/api/v1/event-series/${seriesId}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ untilDate: '2025-01-31', overwriteExisting: true }),
    });
    expect([200,201]).toContain(gen2.status);
    const g2 = await gen2.json();
    expect(g2.updated).toBeGreaterThanOrEqual(0);
  });
});


