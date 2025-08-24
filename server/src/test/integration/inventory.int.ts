import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { randomUUID } from 'node:crypto';
// Placeholder for future expansion tests (transactions/reservations)

const BASE = '/api/v1';
// Ensure tests run against explicit test DB if needed in future expansions
const _DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';
const token = makeEmulatorJwt({ sub: 'inv-user', email: 'inv@example.com', aud: PROJECT_ID });

describe('Inventory golden-master: GET /inventory/items', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(() => {
    app = buildTestApp();
  });

  it('401 unauthenticated', async () => {
    const res = await app.request(`${BASE}/inventory/items`);
    expect(res.status).toBe(401);
  });

  it('200 authenticated', async () => {
    const res = await app.request(`${BASE}/inventory/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('Inventory golden-master: CRUD item, transactions, reservations', () => {
  let app: ReturnType<typeof buildTestApp>;
  let authHeaders: Record<string, string>;
  let itemId: string;
  let locationId: string;

  beforeAll(() => {
    app = buildTestApp();
    authHeaders = { Authorization: `Bearer ${token}` };
  });

  it('creates an item', async () => {
    const res = await app.request(`${BASE}/inventory/items`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        sku: `SKU-${Math.random().toString(36).slice(2, 7)}`,
        name: 'Cable XLR',
        itemType: 'Consumable',
        baseUnit: 'EA',
        attributes: { length_ft: 25 },
      }),
    });
    expect([200,201]).toContain(res.status);
    const body = await res.json();
    itemId = body.itemId;
    expect(itemId).toBeTruthy();
  });

  it('lists locations (legacy parity)', async () => {
    const res = await app.request(`${BASE}/inventory/locations`, { headers: authHeaders });
    // Legacy route exists under api.ts; new modular route not yet implemented for locations – we assert 200 parity
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    locationId = rows[0]?.locationId || rows[0]?.id;
    if (!locationId) {
      const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
      const crypto = await import('node:crypto');
      const newLoc = {
        locationId: crypto.randomUUID(),
        name: 'Main Warehouse',
        departmentId: crypto.randomUUID(),
      } as any;
      await db.insert(schema.locations).values(newLoc);
      locationId = newLoc.locationId;
    }
  });

  it('posts a receipt transaction and then transfer out/in', async () => {
    const receipt = await app.request(`${BASE}/inventory/transactions`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId,
        locationId,
        eventType: 'RECEIPT',
        qtyBase: 10,
        postedBy: randomUUID(),
      }),
    });
    if (receipt.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('receipt error:', await receipt.text());
    }
    expect(receipt.status).toBe(201);

    // Transfer requires a destination; reuse locationId for simplicity if only one exists
    const transfer = await app.request(`${BASE}/inventory/transactions`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId,
        locationId,
        eventType: 'TRANSFER_OUT',
        qtyBase: 5,
        postedBy: randomUUID(),
        transfer: { destinationLocationId: locationId },
      }),
    });
    expect(transfer.status).toBe(201);
    const entries = await transfer.json();
    expect(Array.isArray(entries)).toBe(true);
  }, 15000);

  it('creates and enforces reservation exclusion', async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res1 = await app.request(`${BASE}/inventory/reservations`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ itemId, locationId, eventId: randomUUID(), qtyBase: 2, startTs: start, endTs: end }),
    });
    if (res1.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('reservation error:', await res1.text());
    }
    expect(res1.status).toBe(201);

    const res2 = await app.request(`${BASE}/inventory/reservations`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ itemId, locationId, eventId: 'evt2', qtyBase: 1, startTs: start, endTs: end }),
    });
    // Expect 400 from error mapping
    expect(res2.status).toBe(400);
  }, 15000);
});


