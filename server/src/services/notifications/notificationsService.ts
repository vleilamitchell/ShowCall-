import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { insertMessage, getMessageByDedupeKey, updateMessageStatus } from '../../repositories/messagesRepo';
import { trigger } from './novuClient';

type Channel = 'email' | 'sms' | 'push';

type BaseSend = {
  templateKey: string;
  payload: Record<string, any>;
  context?: Partial<{
    employeeId: string; scheduleId: string; shiftId: string; assignmentId: string; eventId: string;
  }>;
  dedupeKey?: string;
};

export async function sendEmail(args: BaseSend & { toEmail: string; subject?: string }): Promise<typeof schema.messages.$inferSelect> {
  return sendVia('email', {
    templateKey: args.templateKey,
    to: args.toEmail,
    payload: args.payload,
    subject: args.subject,
    context: args.context,
    dedupeKey: args.dedupeKey,
  });
}

export async function sendSms(args: BaseSend & { toPhone: string }): Promise<typeof schema.messages.$inferSelect> {
  return sendVia('sms', {
    templateKey: args.templateKey,
    to: args.toPhone,
    payload: args.payload,
    context: args.context,
    dedupeKey: args.dedupeKey,
  });
}

export async function sendPush(args: BaseSend & { toSubscriberId: string }): Promise<typeof schema.messages.$inferSelect> {
  return sendVia('push', {
    templateKey: args.templateKey,
    to: args.toSubscriberId,
    payload: args.payload,
    context: args.context,
    dedupeKey: args.dedupeKey,
  });
}

async function sendVia(channel: Channel, args: { templateKey: string; to: string; payload: Record<string, any>; subject?: string; context?: BaseSend['context']; dedupeKey?: string }) {
  const db = await getDatabase(getDatabaseUrl());

  if (args.dedupeKey) {
    const existing = await getMessageByDedupeKey(db, args.dedupeKey);
    if (existing) return existing;
  }

  // Generate id
  let id: string | undefined = (globalThis as any)?.crypto?.randomUUID?.();
  if (!id) {
    try { const nc = await import('node:crypto'); if ((nc as any).randomUUID) id = (nc as any).randomUUID(); } catch {}
  }
  if (!id) id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const record: typeof schema.messages.$inferInsert = {
    id,
    channel,
    templateKey: args.templateKey,
    to: args.to,
    subject: args.subject ?? null as any,
    bodyPreview: null as any,
    status: 'queued' as any,
    providerId: null as any,
    error: null as any,
    contextEmployeeId: args.context?.employeeId ?? null as any,
    contextScheduleId: args.context?.scheduleId ?? null as any,
    contextShiftId: args.context?.shiftId ?? null as any,
    contextAssignmentId: args.context?.assignmentId ?? null as any,
    contextEventId: args.context?.eventId ?? null as any,
    dedupeKey: args.dedupeKey ?? null as any,
    sentAt: null as any,
  } as any;

  let current = await insertMessage(db, record);

  try {
    // For push we expect subscriberId; for email/sms we also use subscriberId via Novu subscriber model
    const toSubscriberId = args.to;
    const res = await trigger(args.templateKey, toSubscriberId, args.payload);
    if (!res) {
      current = (await updateMessageStatus(db, current.id, { status: 'failed' as any, error: 'NOVU_API_KEY not configured' } as any)) || current;
    } else if (res.acknowledged) {
      current = (await updateMessageStatus(db, current.id, { status: 'enqueued' as any, providerId: res.id } as any)) || current;
    } else {
      current = (await updateMessageStatus(db, current.id, { status: 'failed' as any, error: 'Novu did not acknowledge' } as any)) || current;
    }
  } catch (e: any) {
    current = (await updateMessageStatus(db, current.id, { status: 'failed' as any, error: String(e?.message || e) } as any)) || current;
  }

  return current;
}


