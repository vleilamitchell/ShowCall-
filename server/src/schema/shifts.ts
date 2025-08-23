import { pgTable, text, timestamp, date, index } from 'drizzle-orm/pg-core';
import { departments } from './departments';
import { schedules } from './schedules';
import { events } from './events';
import { relations } from 'drizzle-orm';

export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
  date: date('date', { mode: 'string' }).notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  title: text('title'),
  notes: text('notes'),
  eventId: text('event_id').references(() => events.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  byDeptDate: index('idx_shifts_dept_date_start').on(table.departmentId, table.date, table.startTime),
  bySchedule: index('idx_shifts_schedule_id').on(table.scheduleId),
  byEvent: index('idx_shifts_event_id').on(table.eventId),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  department: one(departments, {
    fields: [shifts.departmentId],
    references: [departments.id],
  }),
  schedule: one(schedules, {
    fields: [shifts.scheduleId],
    references: [schedules.id],
  }),
  event: one(events, {
    fields: [shifts.eventId],
    references: [events.id],
  }),
}));


