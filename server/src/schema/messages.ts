import { pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Use the same private schema as users
export const appSchema = pgSchema('app');

export const messages = appSchema.table('messages', {
  id: text('id').primaryKey(),
  channel: text('channel').notNull(), // 'email' | 'sms' | 'push'
  templateKey: text('template_key').notNull(),
  to: text('to').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  subject: text('subject'),
  bodyPreview: text('body_preview'),
  status: text('status').notNull(), // 'queued' | 'sent' | 'failed' | 'enqueued' | 'delivered' | 'bounced'
  providerId: text('provider_id'),
  error: text('error'),
  contextEmployeeId: text('ctx_employee_id'),
  contextScheduleId: text('ctx_schedule_id'),
  contextShiftId: text('ctx_shift_id'),
  contextAssignmentId: text('ctx_assignment_id'),
  contextEventId: text('ctx_event_id'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;


