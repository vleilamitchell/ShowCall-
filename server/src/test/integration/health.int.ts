import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../testApp';

describe('Router composition health', () => {
  it('GET /api/v1/health responds OK via legacy router', async () => {
    const app = buildTestApp();
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});


