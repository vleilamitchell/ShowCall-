import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const eventAreas = pgTable('event_areas', {
  eventId: text('event_id').notNull(),
  areaId: text('area_id').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.eventId, t.areaId], name: 'event_areas_pk' }),
}));

export type EventArea = typeof eventAreas.$inferSelect;
export type NewEventArea = typeof eventAreas.$inferInsert;


