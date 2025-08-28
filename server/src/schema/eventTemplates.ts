import { boolean, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { positions } from './positions';
import { areas } from './areas';

export const eventTemplates = pgTable('event_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventTemplateVersions = pgTable('event_template_versions', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => eventTemplates.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  titleTemplate: text('title_template').notNull(),
  notes: text('notes'),
  isCurrent: boolean('is_current').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventTemplateRequirements = pgTable('event_template_requirements', {
  id: text('id').primaryKey(),
  templateVersionId: text('template_version_id').notNull().references(() => eventTemplateVersions.id, { onDelete: 'cascade' }),
  requiredPositionId: text('required_position_id').notNull().references(() => positions.id, { onDelete: 'restrict' }),
  count: integer('count').notNull().default(1),
});

export const eventTemplateRequirementAreas = pgTable('event_template_requirement_areas', {
  templateRequirementId: text('template_requirement_id').notNull().references(() => eventTemplateRequirements.id, { onDelete: 'cascade' }),
  areaId: text('area_id').notNull().references(() => areas.id, { onDelete: 'restrict' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.templateRequirementId, t.areaId], name: 'event_template_requirement_areas_pk' }),
}));

export const eventTemplateVersionAreas = pgTable('event_template_version_areas', {
  templateVersionId: text('template_version_id').notNull().references(() => eventTemplateVersions.id, { onDelete: 'cascade' }),
  areaId: text('area_id').notNull().references(() => areas.id, { onDelete: 'restrict' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.templateVersionId, t.areaId], name: 'event_template_version_areas_pk' }),
}));

export type EventTemplate = typeof eventTemplates.$inferSelect;
export type NewEventTemplate = typeof eventTemplates.$inferInsert;
export type EventTemplateVersion = typeof eventTemplateVersions.$inferSelect;
export type NewEventTemplateVersion = typeof eventTemplateVersions.$inferInsert;
export type EventTemplateRequirement = typeof eventTemplateRequirements.$inferSelect;
export type NewEventTemplateRequirement = typeof eventTemplateRequirements.$inferInsert;


