import { and, asc, eq, inArray, lte, gte } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export type OccurrenceWindow = { fromDate?: string; untilDate: string };

export function startOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day; // anchor week starts Sunday
  const anchor = new Date(d);
  anchor.setUTCDate(d.getUTCDate() - diff);
  return anchor.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function compareDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function computeOccurrences(series: any, rule: any, window: OccurrenceWindow): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const from = window.fromDate || today;
  const seriesStart = series.startDate || from;
  const start = compareDate(seriesStart, from) >= 0 ? seriesStart : from;
  const end = series.endDate ? (series.endDate < window.untilDate ? series.endDate : window.untilDate) : window.untilDate;
  if (compareDate(start, end) > 0) return [];

  const interval = Math.max(1, Number(rule.interval || 1));
  const mask = Number(rule.byWeekdayMask || 0);
  const anchorBase = series.startDate || start;
  const anchorStartOfWeek = startOfWeek(anchorBase);

  const results: string[] = [];
  let d = start;
  while (compareDate(d, end) <= 0) {
    const day = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0..6
    const include = (mask & (1 << day)) !== 0;
    if (include) {
      const daysSinceAnchorStart = Math.floor((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${anchorStartOfWeek}T00:00:00Z`)) / (1000 * 60 * 60 * 24));
      const weeksSinceAnchor = Math.floor(daysSinceAnchorStart / 7);
      if (weeksSinceAnchor % interval === 0) {
        results.push(d);
      }
    }
    d = addDays(d, 1);
  }
  return results;
}

export function buildEventTemplate(series: any): { template: any; mergeStrategy: Record<string, 'overwrite' | 'fillEmpty' | 'append'> } {
  const template: any = {
    status: series.defaultStatus || 'planned',
    startTime: series.defaultStartTime || '00:00',
    endTime: series.defaultEndTime || '23:59',
  };
  if (series.titleTemplate) template.title = series.titleTemplate;
  if (series.promoterTemplate) template.promoter = series.promoterTemplate;
  if (series.artistsTemplate) template.artists = series.artistsTemplate;

  const mergeStrategy: Record<string, 'overwrite' | 'fillEmpty' | 'append'> = {
    status: 'overwrite',
    startTime: 'overwrite',
    endTime: 'overwrite',
    title: 'fillEmpty',
    promoter: 'fillEmpty',
    artists: 'fillEmpty',
    ticketUrl: 'fillEmpty',
    eventPageUrl: 'fillEmpty',
    promoAssetsUrl: 'fillEmpty',
  };
  return { template, mergeStrategy };
}

export function applyTemplateToEvent(existing: any, template: any, mergeStrategy: Record<string, 'overwrite' | 'fillEmpty' | 'append'>) {
  const next = { ...existing };
  for (const key of Object.keys(template)) {
    const strategy = mergeStrategy[key] || 'overwrite';
    const value = template[key];
    if (strategy === 'overwrite') {
      next[key] = value;
    } else if (strategy === 'fillEmpty') {
      if (next[key] == null || String(next[key]).trim() === '') next[key] = value;
    } else if (strategy === 'append') {
      const a = String(next[key] || '').trim();
      const b = String(value || '').trim();
      next[key] = a && b ? `${a} ${b}` : (a || b || null);
    }
  }
  return next;
}

export async function upsertEventsForSeries(seriesId: string, params: { fromDate?: string; untilDate: string; overwriteExisting?: boolean; setAreasMode?: 'replace' | 'skip' }) {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  const sRows = await db.select().from(schema.eventSeries).where(eq(schema.eventSeries.id, seriesId)).limit(1);
  const series = sRows[0];
  if (!series) throw new Error('Series not found');
  const rRows = await db.select().from(schema.eventSeriesRules).where(eq(schema.eventSeriesRules.seriesId, seriesId)).limit(1);
  const rule = rRows[0];
  if (!rule) throw new Error('Series rule not found');
  const areasRows = await db.select({ areaId: schema.eventSeriesAreas.areaId }).from(schema.eventSeriesAreas).where(eq(schema.eventSeriesAreas.seriesId, seriesId));
  const areaIds: string[] = areasRows.map((r: any) => r.areaId);

  const dates = computeOccurrences(series as any, rule as any, { fromDate: params.fromDate, untilDate: params.untilDate });
  const { template, mergeStrategy } = buildEventTemplate(series as any);

  let created = 0, updated = 0, skipped = 0;
  const eventIds: string[] = [];

  for (const date of dates) {
    const existing = await db.select().from(schema.events).where(and(eq(schema.events.seriesId, seriesId), eq(schema.events.date, date))).limit(1);
    if (existing.length === 0) {
      // Insert
      let id: string | undefined;
      const g: any = globalThis as any;
      if (g?.crypto?.randomUUID) id = g.crypto.randomUUID();
      if (!id) { try { const nc = await import('node:crypto'); if (nc.randomUUID) id = nc.randomUUID(); } catch {} }
      if (!id) id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const rec: any = {
        id,
        seriesId,
        date,
        title: (template.title && String(template.title).trim()) || String(series.name || '').trim() || '',
        status: template.status,
        startTime: template.startTime,
        endTime: template.endTime,
        promoter: template.promoter || null,
        artists: template.artists || null,
        ticketUrl: template.ticketUrl || null,
        eventPageUrl: template.eventPageUrl || null,
        promoAssetsUrl: template.promoAssetsUrl || null,
      };
      const inserted = await db.insert(schema.events).values(rec).returning();
      const ev = inserted[0];
      if (ev) {
        eventIds.push(ev.id as any);
        created++;
        // Apply areas via replace semantics
        if (areaIds.length > 0) {
          const current = await db.select({ areaId: schema.eventAreas.areaId }).from(schema.eventAreas).where(eq(schema.eventAreas.eventId, ev.id));
          const currentIds = new Set(current.map((r: any) => r.areaId));
          const toAdd = areaIds.filter((id) => !currentIds.has(id));
          const toRemove = Array.from(currentIds).filter((id) => !areaIds.includes(id));
          if (toRemove.length > 0) {
            await db.delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, ev.id), inArray(schema.eventAreas.areaId as any, toRemove as any) as any));
          }
          for (const aid of toAdd) {
            await db.insert(schema.eventAreas).values({ eventId: ev.id, areaId: aid });
          }
        }
      }
    } else {
      const ev = existing[0];
      if (params.overwriteExisting) {
        const next = applyTemplateToEvent(ev, template, mergeStrategy);
        const updatedRows = await db.update(schema.events).set({
          title: next.title,
          status: next.status,
          startTime: next.startTime,
          endTime: next.endTime,
          promoter: next.promoter,
          artists: next.artists,
          ticketUrl: next.ticketUrl,
          eventPageUrl: next.eventPageUrl,
          promoAssetsUrl: next.promoAssetsUrl,
          updatedAt: new Date(),
        }).where(eq(schema.events.id, ev.id)).returning();
        if (updatedRows[0]) {
          updated++;
          eventIds.push(updatedRows[0].id as any);
          if (params.setAreasMode === 'replace') {
            // replace areas
            const current = await db.select({ areaId: schema.eventAreas.areaId }).from(schema.eventAreas).where(eq(schema.eventAreas.eventId, ev.id));
            const currentIds = new Set(current.map((r: any) => r.areaId));
            const toAdd = areaIds.filter((id) => !currentIds.has(id));
            const toRemove = Array.from(currentIds).filter((id) => !areaIds.includes(id));
            if (toRemove.length > 0) {
              await db.delete(schema.eventAreas).where(and(eq(schema.eventAreas.eventId, ev.id), inArray(schema.eventAreas.areaId as any, toRemove as any) as any));
            }
            for (const aid of toAdd) {
              await db.insert(schema.eventAreas).values({ eventId: ev.id, areaId: aid });
            }
          }
        }
      } else {
        skipped++;
      }
    }
  }

  return { created, updated, skipped, eventIds };
}


