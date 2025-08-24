import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  prefix: text('prefix'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  suffix: text('suffix'),
  address1: text('address1'),
  address2: text('address2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  email: text('email'),
  paymentDetails: text('payment_details'),
  contactNumber: text('contact_number'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;


