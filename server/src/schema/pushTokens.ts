import { pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('app');

export const pushTokens = appSchema.table('push_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(), // 'fcm' | 'apns' | 'webpush'
  token: text('token').notNull(),
  platform: text('platform').notNull(), // 'web' | 'ios' | 'android'
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;


