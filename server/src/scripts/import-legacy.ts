#!/usr/bin/env tsx

import 'dotenv/config';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

type SqlClient = ReturnType<typeof postgres>;

function getBaseDbUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('postgres')) return envUrl;
  // Default to local embedded postgres
  const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5502;
  return `postgresql://postgres:password@localhost:${port}/postgres`;
}

function withDbName(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function createSqlClient(dbUrl: string): Promise<SqlClient> {
  return postgres(dbUrl, {
    prepare: false,
    max: 2,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
  });
}

async function upsertDepartment(db: SqlClient, dept: { id: string; name: string; description?: string | null }) {
  await db.unsafe(
    `insert into departments (id, name, description) values ($1, $2, $3)
     on conflict (id) do update set name = excluded.name, description = excluded.description` as any,
    [dept.id, dept.name, dept.description ?? null]
  );
}

async function upsertPosition(db: SqlClient, pos: { id: string; department_id: string; name: string }) {
  await db.unsafe(
    `insert into positions (id, department_id, name) values ($1, $2, $3)
     on conflict (id) do update set department_id = excluded.department_id, name = excluded.name` as any,
    [pos.id, pos.department_id, pos.name]
  );
}

async function upsertEmployee(db: SqlClient, e: any) {
  await db.unsafe(
    `insert into employees (id, department_id, name, priority, first_name, middle_name, last_name, address1, address2, city, state, postal_code, postal_code4, primary_phone, email, emergency_contact_name, emergency_contact_phone)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     on conflict (id) do update set department_id=excluded.department_id, name=excluded.name, priority=excluded.priority, first_name=excluded.first_name, middle_name=excluded.middle_name, last_name=excluded.last_name, address1=excluded.address1, address2=excluded.address2, city=excluded.city, state=excluded.state, postal_code=excluded.postal_code, postal_code4=excluded.postal_code4, primary_phone=excluded.primary_phone, email=excluded.email, emergency_contact_name=excluded.emergency_contact_name, emergency_contact_phone=excluded.emergency_contact_phone` as any,
    [
      e.id,
      e.department_id,
      e.name,
      e.priority ?? null,
      e.first_name ?? null,
      e.middle_name ?? null,
      e.last_name ?? null,
      e.address1 ?? null,
      e.address2 ?? null,
      e.city ?? null,
      e.state ?? null,
      e.postal_code ?? null,
      e.postal_code4 ?? null,
      e.primary_phone ?? null,
      e.email ?? null,
      e.emergency_contact_name ?? null,
      e.emergency_contact_phone ?? null,
    ]
  );
}

async function upsertEmployeePosition(db: SqlClient, ep: { id: string; department_id: string; employee_id: string; position_id: string; priority?: number | null; is_lead?: boolean | null }) {
  await db.unsafe(
    `insert into employee_positions (id, department_id, employee_id, position_id, priority, is_lead)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set department_id=excluded.department_id, employee_id=excluded.employee_id, position_id=excluded.position_id, priority=excluded.priority, is_lead=excluded.is_lead` as any,
    [ep.id, ep.department_id, ep.employee_id, ep.position_id, ep.priority ?? null, ep.is_lead ?? false]
  );
}

async function upsertEvent(db: SqlClient, ev: any) {
  await db.unsafe(
    `insert into events (id, title, promoter, status, date, start_time, end_time, description, artists, ticket_url, event_page_url, promo_assets_url, series_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     on conflict (id) do update set title=excluded.title, promoter=excluded.promoter, status=excluded.status, date=excluded.date, start_time=excluded.start_time, end_time=excluded.end_time, description=excluded.description, artists=excluded.artists, ticket_url=excluded.ticket_url, event_page_url=excluded.event_page_url, promo_assets_url=excluded.promo_assets_url, series_id=excluded.series_id` as any,
    [
      ev.id,
      ev.title,
      ev.promoter ?? null,
      ev.status ?? 'scheduled',
      ev.date,
      ev.start_time,
      ev.end_time,
      ev.description ?? null,
      ev.artists ?? null,
      ev.ticket_url ?? null,
      ev.event_page_url ?? null,
      ev.promo_assets_url ?? null,
      ev.series_id ?? null,
    ]
  );
}

async function upsertSchedule(db: SqlClient, s: any) {
  await db.unsafe(
    `insert into schedules (id, name, start_date, end_date, is_published)
     values ($1,$2,$3,$4,$5)
     on conflict (id) do update set name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date, is_published=excluded.is_published` as any,
    [s.id, s.name, s.start_date, s.end_date, Boolean(s.is_published)]
  );
}

async function upsertShift(db: SqlClient, sh: any) {
  await db.unsafe(
    `insert into shifts (id, department_id, schedule_id, date, start_time, end_time, title, notes, event_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do update set department_id=excluded.department_id, schedule_id=excluded.schedule_id, date=excluded.date, start_time=excluded.start_time, end_time=excluded.end_time, title=excluded.title, notes=excluded.notes, event_id=excluded.event_id` as any,
    [
      sh.id,
      sh.department_id,
      sh.schedule_id ?? null,
      sh.date,
      sh.start_time,
      sh.end_time,
      sh.title ?? null,
      sh.notes ?? null,
      sh.event_id ?? null,
    ]
  );
}

async function upsertArea(db: SqlClient, a: { id: string; name: string; description?: string | null; color?: string | null; active?: boolean | null; sort_order?: number | null }) {
  await db.unsafe(
    `insert into areas (id, name, description, color, active, sort_order)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set name=excluded.name, description=excluded.description, color=excluded.color, active=excluded.active, sort_order=excluded.sort_order` as any,
    [a.id, a.name, a.description ?? null, a.color ?? null, a.active ?? true, a.sort_order ?? 0]
  );
}

async function upsertEventArea(db: SqlClient, ea: { event_id: string; area_id: string }) {
  await db.unsafe(
    `insert into event_areas (event_id, area_id) values ($1, $2)
     on conflict on constraint event_areas_pk do nothing` as any,
    [ea.event_id, ea.area_id]
  );
}

function coerceId(id: any): string {
  if (!id) return randomUUID();
  return String(id);
}

async function migrateCore(importDb: SqlClient, targetDb: SqlClient) {
  // Departments
  const importDepts = await importDb`
    select id, name, description from departments
  `;
  for (const d of importDepts) {
    await upsertDepartment(targetDb, { id: coerceId(d.id), name: d.name, description: d.description });
  }

  // Positions
  const importPositions = await importDb`
    select id, department_id, name from positions
  `;
  for (const p of importPositions) {
    await upsertPosition(targetDb, { id: coerceId(p.id), department_id: coerceId(p.department_id), name: p.name });
  }

  // Employees
  const importEmployees = await importDb`
    select id, department_id, name, priority, first_name, middle_name, last_name, address1, address2, city, state, postal_code, postal_code4, primary_phone, email, emergency_contact_name, emergency_contact_phone
    from employees
  `;
  for (const e of importEmployees) {
    await upsertEmployee(targetDb, { ...e, id: coerceId(e.id), department_id: coerceId(e.department_id) });
  }

  // Employee Positions
  const importEP = await importDb`
    select id, department_id, employee_id, position_id, priority, is_lead from employee_positions
  `;
  for (const ep of importEP) {
    await upsertEmployeePosition(targetDb, {
      id: coerceId(ep.id),
      department_id: coerceId(ep.department_id),
      employee_id: coerceId(ep.employee_id),
      position_id: coerceId(ep.position_id),
      priority: ep.priority ?? null,
      is_lead: Boolean(ep.is_lead),
    });
  }
}

async function migrateScheduling(importDb: SqlClient, targetDb: SqlClient) {
  // Events
  const importEvents = await importDb`
    select id, title, promoter, status, date, start_time, end_time, description, artists, ticket_url, event_page_url, promo_assets_url, series_id from events
  `;
  for (const ev of importEvents) {
    await upsertEvent(targetDb, { ...ev, id: coerceId(ev.id) });
  }

  // Areas
  try {
    const importAreas = await importDb`
      select id, name, description, color, active, sort_order from areas
    `;
    for (const a of importAreas) {
      await upsertArea(targetDb, { ...a, id: coerceId(a.id) });
    }
  } catch (e) {
    console.warn('Skipping areas import (table not found in legacy DB).');
  }

  // Schedules
  const importSchedules = await importDb`
    select id, name, start_date, end_date, is_published from schedules
  `;
  for (const s of importSchedules) {
    await upsertSchedule(targetDb, { ...s, id: coerceId(s.id) });
  }

  // Shifts
  const importShifts = await importDb`
    select id, department_id, schedule_id, date, start_time, end_time, title, notes, event_id from shifts
  `;
  for (const sh of importShifts) {
    await upsertShift(targetDb, {
      ...sh,
      id: coerceId(sh.id),
      department_id: coerceId(sh.department_id),
      schedule_id: sh.schedule_id ? coerceId(sh.schedule_id) : null,
      event_id: sh.event_id ? coerceId(sh.event_id) : null,
    });
  }

  // Event Areas (many-to-many)
  try {
    const importEventAreas = await importDb`
      select event_id, area_id from event_areas
    `;
    for (const ea of importEventAreas) {
      await upsertEventArea(targetDb, { event_id: coerceId(ea.event_id), area_id: coerceId(ea.area_id) });
    }
  } catch (e) {
    console.warn('Skipping event_areas import (table not found in legacy DB).');
  }
}

async function main() {
  const base = getBaseDbUrl();
  const importUrl = withDbName(base, 'showcall_import');
  const targetUrl = base; // current DB as configured

  const importSql = await createSqlClient(importUrl);
  const targetSql = await createSqlClient(targetUrl);

  console.log('Starting legacy import from "showcall_import" into current database...');

  try {
    await targetSql.begin(async (tx) => {
      await migrateCore(importSql, tx as unknown as SqlClient);
      await migrateScheduling(importSql, tx as unknown as SqlClient);
    });
  } catch (err: any) {
    console.error('Import failed:', err?.message || err);
    throw err;
  }

  console.log('Legacy import completed successfully.');
  await importSql.end({ timeout: 1 });
  await targetSql.end({ timeout: 1 });
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


