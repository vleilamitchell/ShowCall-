import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestApp, makeEmulatorJwt } from '../testApp';

const BASE = '/api/v1';
const _DB_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

describe('GET /api/v1/protected/me', () => {
  let app: ReturnType<typeof buildTestApp>;
  const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';

  beforeAll(() => {
    app = buildTestApp();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request(`${BASE}/protected/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 200 with user when authenticated', async () => {
    const payload = { sub: 'test-user-1', email: 'tester@example.com', aud: projectId };
    const token = makeEmulatorJwt(payload);
    const res = await app.request(`${BASE}/protected/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id', 'test-user-1');
    expect(body.user).toHaveProperty('email', 'tester@example.com');
  });
});


