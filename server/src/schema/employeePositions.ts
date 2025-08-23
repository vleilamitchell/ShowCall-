import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const employeePositions = pgTable('employee_positions', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  employeeId: text('employee_id').notNull(),
  positionId: text('position_id').notNull(),
  priority: integer('priority'),
  isLead: boolean('is_lead').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    employeePositionUnique: uniqueIndex('employee_positions_unique')
      .on(table.departmentId, table.employeeId, table.positionId),
  };
});

export type EmployeePosition = typeof employeePositions.$inferSelect;
export type NewEmployeePosition = typeof employeePositions.$inferInsert;



