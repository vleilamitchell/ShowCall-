import { pgTable, text, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  byDate: index('idx_schedules_start_end').on(table.startDate, table.endDate),
  byPublished: index('idx_schedules_is_published').on(table.isPublished),
}));


