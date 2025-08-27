import { Context } from 'hono';
import { sendEmail, sendSms, sendPush } from '../services/notifications/notificationsService';

export async function testSend(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const channel = String(body.channel || '').toLowerCase();
  const templateKey = String(body.templateKey || '').trim();
  const payload = (body.payload && typeof body.payload === 'object') ? body.payload : {};
  const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey : undefined;
  const context = (body.context && typeof body.context === 'object') ? body.context : undefined;
  if (!templateKey) return c.json({ error: 'templateKey required' }, 400);

  try {
    if (channel === 'email') {
      const toEmail = String(body.toEmail || '').trim();
      if (!toEmail) return c.json({ error: 'toEmail required' }, 400);
      const subject = typeof body.subject === 'string' ? body.subject : undefined;
      const row = await sendEmail({ templateKey, toEmail, subject, payload, context, dedupeKey });
      return c.json(row, 201);
    }
    if (channel === 'sms') {
      const toPhone = String(body.toPhone || '').trim();
      if (!toPhone) return c.json({ error: 'toPhone required' }, 400);
      const row = await sendSms({ templateKey, toPhone, payload, context, dedupeKey });
      return c.json(row, 201);
    }
    if (channel === 'push') {
      const toSubscriberId = String(body.toSubscriberId || '').trim();
      if (!toSubscriberId) return c.json({ error: 'toSubscriberId required' }, 400);
      const row = await sendPush({ templateKey, toSubscriberId, payload, context, dedupeKey });
      return c.json(row, 201);
    }
    return c.json({ error: 'channel must be email|sms|push' }, 400);
  } catch (e: any) {
    return c.json({ error: 'send_failed', details: String(e?.message || e) }, 500);
  }
}


