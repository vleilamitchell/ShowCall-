import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import * as schema from '../../schema';

export function distributeCountsEvenly(totalCount: number, shiftIds: string[]): Record<string, number> {
  const n = shiftIds.length || 1;
  const base = Math.floor(totalCount / n);
  const r = totalCount % n;
  const result: Record<string, number> = {};
  for (let i = 0; i < shiftIds.length; i++) {
    result[shiftIds[i]!] = base + (i < r ? 1 : 0);
  }
  return result;
}

export async function applyTemplateToEvent(eventId: string, versionId: string, options: { mode?: 'replace' | 'add'; shiftIds?: string[]; createAssignments?: boolean }) {
  const db = await getDatabase();
  const mode = options.mode === 'replace' ? 'replace' : 'add';
  const createAssignments = options.createAssignments !== false;

  // Attach template refs to event if missing
  const vRows = await db.select().from(schema.eventTemplateVersions).where(eq(schema.eventTemplateVersions.id, versionId)).limit(1);
  const version = vRows[0];
  if (!version) throw new Error('TemplateVersionNotFound');

  await db.update(schema.events).set({ templateId: (version as any).templateId, templateVersionId: versionId, updatedAt: new Date() }).where(eq(schema.events.id, eventId));

  if (!createAssignments) {
    return { created: 0, replaced: 0, skipped: 0, assignmentIds: [], warning: 'assignments_not_created' };
  }

  // Determine target shifts
  let shifts = await db
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.eventId, eventId))
    .orderBy(asc(schema.shifts.date), asc(schema.shifts.startTime));
  if (Array.isArray(options.shiftIds) && options.shiftIds.length > 0) {
    const set = new Set(options.shiftIds);
    shifts = shifts.filter((s: any) => set.has(s.id));
  }
  const shiftIds = shifts.map((s: any) => s.id);
  if (shiftIds.length === 0) {
    return { created: 0, replaced: 0, skipped: 0, assignmentIds: [], warning: 'event_has_no_shifts' };
  }

  // Load requirements
  const reqs = await db.select().from(schema.eventTemplateRequirements).where(eq(schema.eventTemplateRequirements.templateVersionId, versionId));
  // Optional replace mode: delete previous assignments sourced from this version
  let replaced = 0;
  if (mode === 'replace') {
    const existing = await db.select({ id: schema.assignments.id }).from(schema.assignments)
      .innerJoin(schema.shifts, eq(schema.assignments.shiftId, schema.shifts.id))
      .where(and(eq(schema.shifts.eventId, eventId), eq(schema.assignments.sourceTemplateVersionId as any, versionId as any)) as any);
    const ids = (existing as any[]).map((r) => r.id);
    if (ids.length > 0) {
      const del = await db.delete(schema.assignments).where((inArray as any)(schema.assignments.id, ids)).returning({ id: schema.assignments.id });
      replaced = del.length;
    }
  }

  const createdIds: string[] = [];
  for (const r of reqs as any[]) {
    const total = Math.max(1, Number(r.count || 1));
    const distribution = distributeCountsEvenly(total, shiftIds);
    // Fetch allowed areas for this requirement; fall back to version-level areas
    let areas = await db
      .select({ areaId: schema.eventTemplateRequirementAreas.areaId })
      .from(schema.eventTemplateRequirementAreas)
      .where(eq(schema.eventTemplateRequirementAreas.templateRequirementId, r.id));
    if ((areas as any[]).length === 0) {
      areas = await db
        .select({ areaId: schema.eventTemplateVersionAreas.areaId })
        .from(schema.eventTemplateVersionAreas)
        .where(eq(schema.eventTemplateVersionAreas.templateVersionId, versionId));
    }
    const defaultAreaId = (areas as any[])[0]?.areaId || null;
    // For each shift, create assignments
    for (const sid of shiftIds) {
      const count = distribution[sid] || 0;
      for (let i = 0; i < count; i++) {
        let id: string | undefined;
        const g: any = globalThis as any; if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
        if (!id) { try { const nc = await import('node:crypto'); if (nc.randomUUID) id = nc.randomUUID(); } catch {} }
        if (!id) id = `asg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const depRows = await db.select({ departmentId: schema.shifts.departmentId }).from(schema.shifts).where(eq(schema.shifts.id, sid)).limit(1);
        const departmentId = depRows[0]?.departmentId as any;
        const [inserted] = await db.insert(schema.assignments).values({
          id,
          departmentId,
          shiftId: sid,
          requiredPositionId: r.requiredPositionId,
          assigneeEmployeeId: null,
          areaId: defaultAreaId,
          sourceTemplateVersionId: versionId as any,
        }).returning();
        if (inserted) createdIds.push(inserted.id as any);
      }
    }
  }

  return { created: createdIds.length, replaced, skipped: 0, assignmentIds: createdIds };
}


