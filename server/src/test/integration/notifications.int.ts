import { describe, it, expect, beforeAll } from 'vitest';
import buildApp from '../../app';

describe('notifications integration', () => {
  const app = buildApp({ injectAuth: { userId: 'u_test', email: 'u@test.local' }, disableLogger: true });

  it('POST /api/v1/internal/notifications/test queues a message', async () => {
    const res = await app.request('/api/v1/internal/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user': JSON.stringify({ userId: 'u_test', email: 'u@test.local' }) },
      body: JSON.stringify({ channel: 'push', templateKey: 'GENERIC_BROADCAST', toSubscriberId: 'u_test', payload: { msg: 'hi' } }),
    });
    expect(res.status).toBeLessThanOrEqual(201);
  });
});


