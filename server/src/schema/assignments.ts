import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { departments } from './departments';
import { shifts } from './shifts';
import { positions } from './positions';
import { employees } from './employees';
import { relations } from 'drizzle-orm';

export const assignments = pgTable('assignments', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  shiftId: text('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  requiredPositionId: text('required_position_id').notNull().references(() => positions.id, { onDelete: 'restrict' }),
  assigneeEmployeeId: text('assignee_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  byShift: index('idx_assignments_shift_id').on(table.shiftId),
  byDeptPosition: index('idx_assignments_dept_position').on(table.departmentId, table.requiredPositionId),
  byAssignee: index('idx_assignments_assignee').on(table.assigneeEmployeeId),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  department: one(departments, { fields: [assignments.departmentId], references: [departments.id] }),
  shift: one(shifts, { fields: [assignments.shiftId], references: [shifts.id] }),
  requiredPosition: one(positions, { fields: [assignments.requiredPositionId], references: [positions.id] }),
  assignee: one(employees, { fields: [assignments.assigneeEmployeeId], references: [employees.id] }),
}));


