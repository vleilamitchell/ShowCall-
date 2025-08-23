import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  name: text('name').notNull(),
  priority: integer('priority'),
  firstName: text('first_name'),
  middleName: text('middle_name'),
  lastName: text('last_name'),
  address1: text('address1'),
  address2: text('address2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  postalCode4: text('postal_code4'),
  primaryPhone: text('primary_phone'),
  email: text('email'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;


