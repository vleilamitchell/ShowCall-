import { pgTable, text, timestamp, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const eventSeries = pgTable('event_series', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  defaultStatus: text('default_status').notNull().default('planned'),
  defaultStartTime: text('default_start_time').notNull().default('00:00'),
  defaultEndTime: text('default_end_time').notNull().default('23:59'),
  titleTemplate: text('title_template'),
  promoterTemplate: text('promoter_template'),
  templateJson: jsonb('template_json'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventSeriesRules = pgTable('event_series_rules', {
  id: text('id').primaryKey(),
  seriesId: text('series_id').notNull(),
  frequency: text('frequency').notNull(),
  interval: integer('interval').notNull().default(1),
  byWeekdayMask: integer('by_weekday_mask').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventSeriesAreas = pgTable('event_series_areas', {
  seriesId: text('series_id').notNull(),
  areaId: text('area_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.seriesId, t.areaId], name: 'event_series_areas_pk' }),
}));

export type EventSeries = typeof eventSeries.$inferSelect;
export type NewEventSeries = typeof eventSeries.$inferInsert;
export type EventSeriesRule = typeof eventSeriesRules.$inferSelect;
export type NewEventSeriesRule = typeof eventSeriesRules.$inferInsert;


