import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Standardize on public schema for events table to match migrations
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  promoter: text('promoter'),
  status: text('status').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
  description: text('description'),
  artists: text('artists'), // comma-separated for now
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;


