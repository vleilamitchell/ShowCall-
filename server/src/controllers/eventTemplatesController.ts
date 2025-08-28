import { Context } from 'hono';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import * as schema from '../schema';

export async function listTemplates(c: Context) {
  const db = await getDatabase();
  const q = c.req.query('q') || undefined;
  const activeParam = c.req.query('active');
  const conditions: any[] = [];
  if (q) conditions.push((schema as any).ilike ? (schema as any).ilike(schema.eventTemplates.name as any, `%${q}%`) : undefined);
  if (activeParam != null) conditions.push(eq(schema.eventTemplates.active, activeParam === 'true'));
  const whereClause = conditions.length > 0 ? (and as any)(...conditions.filter(Boolean)) : undefined;
  const rows = await db.select().from(schema.eventTemplates).where(whereClause as any).orderBy(asc(schema.eventTemplates.name));
  return c.json(rows);
}

export async function createTemplate(c: Context) {
  const db = await getDatabase();
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) return c.json({ error: 'name required' }, 400);
  const description = (typeof body.description === 'string' ? body.description.trim() : '') || null;
  const titleTemplate = String(body.titleTemplate || '').trim();
  if (!titleTemplate) return c.json({ error: 'titleTemplate required' }, 400);
  const g: any = globalThis as any; let id: string | undefined = g?.crypto?.randomUUID?.();
  if (!id) { try { const nc = await import('node:crypto'); if (nc.randomUUID) id = nc.randomUUID(); } catch {}
  }
  if (!id) id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const rec = { id, name, description } as const;
  const inserted = await db.insert(schema.eventTemplates).values(rec).returning();
  const template = inserted[0];
  // Create first version
  const g2: any = globalThis as any; let vId: string | undefined = g2?.crypto?.randomUUID?.();
  if (!vId) { try { const nc = await import('node:crypto'); if (nc.randomUUID) vId = nc.randomUUID(); } catch {}
  }
  if (!vId) vId = `tpv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ver = await db.insert(schema.eventTemplateVersions).values({ id: vId, templateId: template.id as any, versionNumber: 1, titleTemplate, isCurrent: true }).returning();
  // Optional: initial version-level allowed areas
  const initialAreas: string[] = Array.isArray((body as any).allowedAreaIds) ? Array.from(new Set((body as any).allowedAreaIds.filter(Boolean))) : [];
  if (initialAreas.length > 0) {
    for (const aid of initialAreas) {
      await db.insert(schema.eventTemplateVersionAreas).values({ templateVersionId: ver[0].id as any, areaId: aid });
    }
  }
  return c.json({ ...template, currentVersion: ver[0] }, 201);
}

export async function getTemplate(c: Context) {
  const db = await getDatabase();
  const templateId = c.req.param('templateId');
  const rows = await db.select().from(schema.eventTemplates).where(eq(schema.eventTemplates.id, templateId)).limit(1);
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
  const versions = await db.select().from(schema.eventTemplateVersions).where(eq(schema.eventTemplateVersions.templateId, templateId)).orderBy(asc(schema.eventTemplateVersions.versionNumber));
  const current = versions.find((v: any) => v.isCurrent);
  return c.json({ ...rows[0], versions, currentVersionId: current?.id || null });
}

export async function patchTemplate(c: Context) {
  const db = await getDatabase();
  const templateId = c.req.param('templateId');
  const body = await c.req.json();
  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('description' in body) patch.description = (typeof body.description === 'string' ? body.description.trim() : null);
  if ('active' in body) patch.active = Boolean(body.active);
  patch.updatedAt = new Date();
  const updated = await db.update(schema.eventTemplates).set(patch).where(eq(schema.eventTemplates.id, templateId)).returning();
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(updated[0]);
}

export async function listVersions(c: Context) {
  const db = await getDatabase();
  const templateId = c.req.param('templateId');
  const rows = await db.select().from(schema.eventTemplateVersions).where(eq(schema.eventTemplateVersions.templateId, templateId)).orderBy(asc(schema.eventTemplateVersions.versionNumber));
  return c.json(rows);
}

export async function createVersion(c: Context) {
  const db = await getDatabase();
  const templateId = c.req.param('templateId');
  const body = await c.req.json();
  const cloneFrom = String(body.cloneFromVersionId || '').trim() || undefined;
  const existing = await db.select().from(schema.eventTemplateVersions).where(eq(schema.eventTemplateVersions.templateId, templateId)).orderBy(desc(schema.eventTemplateVersions.versionNumber));
  const nextVersionNumber = (existing[0]?.versionNumber || 0) + 1;
  const g: any = globalThis as any; let id: string | undefined = g?.crypto?.randomUUID?.();
  if (!id) { try { const nc = await import('node:crypto'); if (nc.randomUUID) id = nc.randomUUID(); } catch {} }
  if (!id) id = `tpv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let titleTemplate = String(body.titleTemplate || '').trim();
  if (!titleTemplate) {
    const curr = existing.find((v: any) => v.isCurrent) || existing[0];
    titleTemplate = curr?.titleTemplate || '';
  }
  const inserted = await db.insert(schema.eventTemplateVersions).values({ id, templateId, versionNumber: nextVersionNumber, titleTemplate, notes: (typeof body.notes === 'string' ? body.notes.trim() : null), isCurrent: false }).returning();
  // If cloneFrom provided, clone requirements
  const fromId = cloneFrom || existing.find((v: any) => v.isCurrent)?.id;
  if (fromId) {
    const reqs = await db.select().from(schema.eventTemplateRequirements).where(eq(schema.eventTemplateRequirements.templateVersionId, fromId));
    for (const r of reqs as any[]) {
      const g2: any = globalThis as any; let rid: string | undefined = g2?.crypto?.randomUUID?.();
      if (!rid) { try { const nc = await import('node:crypto'); if (nc.randomUUID) rid = nc.randomUUID(); } catch {} }
      if (!rid) rid = `tpr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const [newReq] = await db.insert(schema.eventTemplateRequirements).values({ id: rid, templateVersionId: inserted[0].id as any, requiredPositionId: (r as any).requiredPositionId, count: (r as any).count }).returning();
      const areas = await db.select({ areaId: schema.eventTemplateRequirementAreas.areaId }).from(schema.eventTemplateRequirementAreas).where(eq(schema.eventTemplateRequirementAreas.templateRequirementId, (r as any).id));
      for (const a of areas as any[]) {
        await db.insert(schema.eventTemplateRequirementAreas).values({ templateRequirementId: newReq.id as any, areaId: a.areaId });
      }
    }
  }
  // Version-level allowed areas: use provided list or clone from source version
  const providedAreas: string[] = Array.isArray((body as any).allowedAreaIds) ? Array.from(new Set((body as any).allowedAreaIds.filter(Boolean))) : [];
  if (providedAreas.length > 0) {
    for (const aid of providedAreas) {
      await db.insert(schema.eventTemplateVersionAreas).values({ templateVersionId: inserted[0].id as any, areaId: aid });
    }
  } else if (fromId) {
    const verAreas = await db.select({ areaId: schema.eventTemplateVersionAreas.areaId }).from(schema.eventTemplateVersionAreas).where(eq(schema.eventTemplateVersionAreas.templateVersionId, fromId));
    for (const a of verAreas as any[]) {
      await db.insert(schema.eventTemplateVersionAreas).values({ templateVersionId: inserted[0].id as any, areaId: a.areaId });
    }
  }
  return c.json(inserted[0], 201);
}

export async function activateVersion(c: Context) {
  const db = await getDatabase();
  const versionId = c.req.param('versionId');
  const rows = await db.select().from(schema.eventTemplateVersions).where(eq(schema.eventTemplateVersions.id, versionId)).limit(1);
  const v = rows[0];
  if (!v) return c.json({ error: 'Not found' }, 404);
  await db.update(schema.eventTemplateVersions).set({ isCurrent: false, updatedAt: new Date() }).where(eq(schema.eventTemplateVersions.templateId, v.templateId));
  const updated = await db.update(schema.eventTemplateVersions).set({ isCurrent: true, updatedAt: new Date() }).where(eq(schema.eventTemplateVersions.id, versionId)).returning();
  return c.json(updated[0]);
}

export async function getRequirements(c: Context) {
  const db = await getDatabase();
  const versionId = c.req.param('versionId');
  const reqs = await db.select().from(schema.eventTemplateRequirements).where(eq(schema.eventTemplateRequirements.templateVersionId, versionId));
  const reqIds = (reqs as any[]).map((r) => r.id);
  let areasByReq = new Map<string, string[]>();
  if (reqIds.length > 0) {
    const rows = await db
      .select({ templateRequirementId: schema.eventTemplateRequirementAreas.templateRequirementId, areaId: schema.eventTemplateRequirementAreas.areaId })
      .from(schema.eventTemplateRequirementAreas)
      .where((inArray as any)(schema.eventTemplateRequirementAreas.templateRequirementId, reqIds));
    for (const row of rows as any[]) {
      const list = areasByReq.get(row.templateRequirementId) || [];
      list.push(row.areaId);
      areasByReq.set(row.templateRequirementId, list);
    }
  }
  const result = (reqs as any[]).map((r) => ({ id: r.id, requiredPositionId: r.requiredPositionId, count: r.count, allowedAreaIds: areasByReq.get(r.id) || [] }));
  return c.json(result);
}

export async function putRequirements(c: Context) {
  const db = await getDatabase();
  const versionId = c.req.param('versionId');
  const body = await c.req.json();
  const items: Array<{ requiredPositionId: string; count: number; allowedAreaIds?: string[] }> = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
  // Delete existing
  const existing = await db.select().from(schema.eventTemplateRequirements).where(eq(schema.eventTemplateRequirements.templateVersionId, versionId));
  const existingIds = (existing as any[]).map((r) => r.id);
  if (existingIds.length > 0) {
    await db.delete(schema.eventTemplateRequirementAreas).where((inArray as any)(schema.eventTemplateRequirementAreas.templateRequirementId, existingIds));
    await db.delete(schema.eventTemplateRequirements).where((inArray as any)(schema.eventTemplateRequirements.id, existingIds));
  }
  const created: string[] = [];
  for (const it of items) {
    const g: any = globalThis as any; let rid: string | undefined = g?.crypto?.randomUUID?.();
    if (!rid) { try { const nc = await import('node:crypto'); if (nc.randomUUID) rid = nc.randomUUID(); } catch {} }
    if (!rid) rid = `tpr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const [row] = await db.insert(schema.eventTemplateRequirements).values({ id: rid, templateVersionId: versionId, requiredPositionId: it.requiredPositionId, count: Math.max(1, Number(it.count || 1)) }).returning();
    created.push(row.id as any);
    const allowed = Array.isArray(it.allowedAreaIds) ? Array.from(new Set(it.allowedAreaIds.filter(Boolean))) : [];
    for (const aid of allowed) {
      await db.insert(schema.eventTemplateRequirementAreas).values({ templateRequirementId: row.id as any, areaId: aid });
    }
  }
  return c.json({ created: created.length, ids: created });
}

export async function getVersionAreas(c: Context) {
  const db = await getDatabase();
  const versionId = c.req.param('versionId');
  const rows = await db
    .select({ areaId: schema.eventTemplateVersionAreas.areaId })
    .from(schema.eventTemplateVersionAreas)
    .where(eq(schema.eventTemplateVersionAreas.templateVersionId, versionId));
  const list = (rows as any[]).map((r) => r.areaId);
  return c.json(list);
}

export async function putVersionAreas(c: Context) {
  const db = await getDatabase();
  const versionId = c.req.param('versionId');
  const body = await c.req.json();
  const areas: string[] = Array.isArray(body) ? body : (Array.isArray(body.allowedAreaIds) ? body.allowedAreaIds : []);
  const unique = Array.from(new Set(areas.filter(Boolean)));
  await db.delete(schema.eventTemplateVersionAreas).where(eq(schema.eventTemplateVersionAreas.templateVersionId, versionId));
  for (const aid of unique) {
    await db.insert(schema.eventTemplateVersionAreas).values({ templateVersionId: versionId as any, areaId: aid });
  }
  return c.json({ count: unique.length, areaIds: unique });
}


