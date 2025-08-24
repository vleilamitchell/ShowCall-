import { boolean, date, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const addresses = pgTable('addresses', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  role: text('role'),
  validFrom: date('valid_from', { mode: 'string' }),
  validTo: date('valid_to', { mode: 'string' }),
  isPrimary: boolean('is_primary').notNull().default(false),
  addressLine1: text('address_line_1').notNull(),
  addressLine2: text('address_line_2'),
  city: text('city').notNull(),
  county: text('county'),
  state: text('state').notNull(), // validated in API to be 2-letter uppercase
  zipCode: text('zip_code').notNull(),
  zipPlus4: text('zip_plus4'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  uspsStandardized: text('usps_standardized'),
  rawInput: text('raw_input'),
  verified: boolean('verified').notNull().default(false),
  verificationDate: date('verification_date', { mode: 'string' }),
  dataSource: text('data_source').notNull().default('manual'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;


