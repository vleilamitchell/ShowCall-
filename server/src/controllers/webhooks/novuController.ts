import { Context } from 'hono';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import { findMessageByProviderId, updateMessageStatus } from '../../repositories/messagesRepo';

export async function handleWebhook(c: Context) {
  const payload = await c.req.json().catch(() => ({}));
  const event = String((payload as any)?.type || (payload as any)?.event || '').toLowerCase();
  const providerId = String((payload as any)?.id || (payload as any)?.messageId || (payload as any)?.data?._id || '').trim();
  const db = await getDatabase(getDatabaseUrl());
  if (!providerId) return c.json({ ok: false, error: 'missing_provider_id' }, 400);
  const msg = await findMessageByProviderId(db, providerId);
  if (!msg) return c.json({ ok: true });

  let status: 'delivered' | 'bounced' | 'failed' | null = null;
  if (event.includes('delivered')) status = 'delivered';
  else if (event.includes('bounce') || event.includes('bounced')) status = 'bounced';
  else if (event.includes('failed') || event.includes('error')) status = 'failed';

  if (status) {
    await updateMessageStatus(db, msg.id, { status } as any);
  }
  return c.json({ ok: true });
}


