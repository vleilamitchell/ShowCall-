import { describe, it, expect } from 'vitest';
import buildApp from '../../app';

describe('push tokens', () => {
  const app = buildApp({ injectAuth: { userId: 'u_test2', email: 'u2@test.local' }, disableLogger: true });

  it('POST /api/v1/me/push-tokens stores token', async () => {
    const res = await app.request('/api/v1/me/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user': JSON.stringify({ userId: 'u_test2', email: 'u2@test.local' }) },
      body: JSON.stringify({ token: 'tok_123', provider: 'fcm', platform: 'web' }),
    });
    expect([200,201]).toContain(res.status);
  });
});


