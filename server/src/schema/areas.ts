import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const areas = pgTable('areas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;


