import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbMod from '../lib/db';
import * as env from '../lib/env';
import * as repo from '../repositories/messagesRepo';
import { sendEmail } from '../services/notifications/notificationsService';
import * as novu from '../services/notifications/novuClient';

describe('notificationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces idempotency via dedupeKey', async () => {
    vi.spyOn(env, 'getDatabaseUrl').mockReturnValue('postgresql://postgres:password@localhost:5502/postgres');
    const fakeDb: any = {};
    vi.spyOn(dbMod, 'getDatabase').mockResolvedValue(fakeDb);
    const existing = { id: 'm1', status: 'queued' } as any;
    vi.spyOn(repo, 'getMessageByDedupeKey').mockResolvedValue(existing);
    const res = await sendEmail({ templateKey: 'T', toEmail: 'a@b.com', payload: {}, dedupeKey: 'k1' });
    expect(res).toBe(existing);
  });

  it('updates status to enqueued on Novu acknowledged', async () => {
    vi.spyOn(env, 'getDatabaseUrl').mockReturnValue('postgresql://postgres:password@localhost:5502/postgres');
    const fakeDb: any = { select: () => ({ from: () => ({ where: () => ({ limit: () => [{ id: 'x' }] }) }) }) } as any;
    vi.spyOn(dbMod, 'getDatabase').mockResolvedValue(fakeDb);
    vi.spyOn(repo, 'getMessageByDedupeKey').mockResolvedValue(null);
    vi.spyOn(repo, 'insertMessage').mockResolvedValue({ id: 'x' } as any);
    const upd = vi.spyOn(repo, 'updateMessageStatus').mockResolvedValue({ id: 'x', status: 'enqueued' } as any);
    vi.spyOn(novu, 'trigger').mockResolvedValue({ acknowledged: true, id: 'prov1' });
    const res = await sendEmail({ templateKey: 'T', toEmail: 'a@b.com', payload: {} });
    expect(upd).toHaveBeenCalled();
    expect(res).toBeTruthy();
  });
});


