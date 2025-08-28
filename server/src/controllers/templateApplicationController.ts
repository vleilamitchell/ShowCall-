import { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../lib/db';
import * as schema from '../schema';
import { applyTemplateToEvent as applyTemplate } from '../services/events/templateApplication';

export async function applyToEvent(c: Context) {
  const db = await getDatabase();
  const eventId = c.req.param('eventId');
  const body = await c.req.json().catch(() => ({}));
  const templateVersionId = typeof body.templateVersionId === 'string' && body.templateVersionId.trim() ? String(body.templateVersionId).trim() : undefined;
  const mode: 'replace' | 'add' = body.mode === 'replace' ? 'replace' : 'add';
  const shiftIds: string[] | undefined = Array.isArray(body.shiftIds) ? body.shiftIds.map((s: any) => String(s || '').trim()).filter(Boolean) : undefined;
  const createAssignments: boolean = body.createAssignments == null ? true : Boolean(body.createAssignments);

  const rows = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
  const event = rows[0];
  if (!event) return c.json({ error: 'EventNotFound' }, 404);

  const versionId = templateVersionId || (event as any).templateVersionId || undefined;
  if (!versionId) return c.json({ error: 'templateVersionId required' }, 400);

  const res = await applyTemplate(eventId, versionId, { mode, shiftIds, createAssignments });
  return c.json(res);
}


