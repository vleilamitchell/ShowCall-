import { pgTable, uuid, text, boolean, jsonb, timestamp, integer, numeric } from 'drizzle-orm/pg-core';

export const attributeSchema = pgTable('attribute_schema', {
  schemaId: uuid('schema_id').primaryKey(),
  itemType: text('item_type').notNull(),
  departmentId: uuid('department_id'),
  version: integer('version').notNull(),
  jsonSchema: jsonb('json_schema').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const items = pgTable('item', {
  itemId: uuid('item_id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  itemType: text('item_type').notNull(),
  baseUnit: text('base_unit').notNull(),
  categoryId: uuid('category_id'),
  schemaId: uuid('schema_id').notNull(),
  attributes: jsonb('attributes').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const assetSpecs = pgTable('asset_specs', {
  itemId: uuid('item_id').primaryKey(),
  requiresSerial: boolean('requires_serial').default(true),
  serviceIntervalDays: integer('service_interval_days'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const locations = pgTable('location', {
  locationId: uuid('location_id').primaryKey(),
  name: text('name').notNull(),
  departmentId: uuid('department_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const inventoryTxn = pgTable('inventory_txn', {
  txnId: uuid('txn_id').primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
  itemId: uuid('item_id').notNull(),
  locationId: uuid('location_id').notNull(),
  eventType: text('event_type').notNull(),
  qtyBase: numeric('qty_base').notNull(),
  lotId: uuid('lot_id'),
  serialNo: text('serial_no'),
  costPerBase: numeric('cost_per_base'),
  sourceDoc: jsonb('source_doc'),
  postedBy: uuid('posted_by').notNull(),
});

export const reservations = pgTable('reservation', {
  resId: uuid('res_id').primaryKey(),
  itemId: uuid('item_id').notNull(),
  locationId: uuid('location_id').notNull(),
  eventId: uuid('event_id').notNull(),
  qtyBase: numeric('qty_base').notNull(),
  startTs: timestamp('start_ts', { withTimezone: true }).notNull(),
  endTs: timestamp('end_ts', { withTimezone: true }).notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const policies = pgTable('policy', {
  policyId: uuid('policy_id').primaryKey(),
  departmentId: uuid('department_id').notNull(),
  itemType: text('item_type').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const unitConversions = pgTable('unit_conversion', {
  fromUnit: text('from_unit').notNull(),
  toUnit: text('to_unit').notNull(),
  factor: numeric('factor').notNull(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;


