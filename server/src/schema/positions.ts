import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const positions = pgTable('positions', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  name: text('name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;



