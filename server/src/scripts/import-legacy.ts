import 'dotenv/config';
import postgres from 'postgres';
import { randomUUID } from 'crypto';
import { getDatabase, withTransaction } from '../lib/db';
import {
  departments as departmentsTable,
  positions as positionsTable,
  employees as employeesTable,
  employeePositions as employeePositionsTable,
  areas as areasTable,
  schedules as schedulesTable,
  shifts as shiftsTable,
  events as eventsTable,
  eventAreas as eventAreasTable,
  eventSeries as eventSeriesTable,
  eventSeriesRules as eventSeriesRulesTable,
  eventSeriesAreas as eventSeriesAreasTable,
  // Inventory
  inventoryItems,
  attributeSchema,
  assetSpecs,
  locations,
  inventoryTxn,
  reservations,
  policies,
  unitConversions,
  valuationAvg,
} from '../schema';

type LegacyRow = Record<string, any>;

type LegacyConnection = ReturnType<typeof postgres>;

type NameToIdMap = Map<string, string>;

interface ImportOptions {
  dryRun: boolean;
  legacyUrl: string;
  appUrl?: string;
}

interface ImportStats {
  departmentsInserted: number;
  positionsInserted: number;
  employeesInserted: number;
  employeePositionsInserted: number;
  areasInserted: number;
  schedulesInserted: number;
  shiftsInserted: number;
  eventsInserted: number;
  eventAreasInserted: number;
  seriesInserted: number;
  seriesRulesInserted: number;
  seriesAreasInserted: number;
  inventoryItemsInserted: number;
  assetSpecsInserted: number;
  locationsInserted: number;
  inventoryTxnsInserted: number;
  reservationsInserted: number;
  policiesInserted: number;
  unitConversionsInserted: number;
  valuationAvgInserted: number;
  warnings: string[];
}

function toKey(str: string | null | undefined): string {
  return (str || '').trim().toLowerCase();
}

function pick(row: LegacyRow, candidates: string[]): any {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null) return row[c];
  }
  return undefined;
}

function splitMulti(value: unknown): string[] {
  if (value == null) return [];
  const s = String(value);
  if (!s) return [];
  return s
    .split(/[;,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function safeJson(value: any): any {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function asString(value: any): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function asBool(value: any): boolean | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase();
  if (['true', 't', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', 'f', '0', 'no', 'n'].includes(s)) return false;
  return null;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

function normalizeDate(value: any): string {
  if (!value) return '1970-01-01';
  const s = String(value);
  // If already YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  // Fallback: try first 10 chars
  return s.slice(0, 10);
}

function normalizeTime(value: any): string {
  if (!value) return '00:00';
  const s = String(value).trim();
  const hm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hm) {
    const h = Math.min(23, Math.max(0, parseInt(hm[1], 10)));
    const m = Math.min(59, Math.max(0, parseInt(hm[2], 10)));
    return `${pad2(h)}:${pad2(m)}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return '00:00';
}

function normalizeTimestamp(value: any): string {
  if (!value) return new Date(0).toISOString();
  const d = new Date(String(value));
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try parse millis
  const n = Number(value);
  if (!isNaN(n)) return new Date(n).toISOString();
  return new Date(0).toISOString();
}

function isUuid(v: any): boolean {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

function coerceUuid(v: any): string {
  if (v && isUuid(String(v))) return String(v);
  return randomUUID();
}

async function connectLegacy(legacyUrl: string): Promise<LegacyConnection> {
  return postgres(legacyUrl, { prepare: false });
}

async function listTables(client: LegacyConnection): Promise<string[]> {
  const rows = await client<LegacyRow[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `;
  return rows.map((r) => r.table_name as string);
}

async function listColumns(client: LegacyConnection, table: string): Promise<Set<string>> {
  const rows = await client<LegacyRow[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `;
  return new Set(rows.map((r) => String(r.column_name)));
}

async function findCandidateTable(
  client: LegacyConnection,
  opts: { nameIncludes?: string[]; columnsAny?: string[]; columnsAll?: string[] }
): Promise<string | null> {
  const tables = await listTables(client);
  for (const t of tables) {
    const tKey = toKey(t);
    if (opts.nameIncludes && opts.nameIncludes.some((inc) => tKey.includes(inc))) return t;
  }
  for (const t of tables) {
    const cols = await listColumns(client, t);
    const colsKey = new Set([...cols].map((c) => toKey(c)));
    if (opts.columnsAll && !opts.columnsAll.every((c) => colsKey.has(toKey(c)))) continue;
    if (opts.columnsAny && !opts.columnsAny.some((c) => colsKey.has(toKey(c)))) continue;
    return t;
  }
  return null;
}

async function loadLegacyRows(client: LegacyConnection, table: string): Promise<LegacyRow[]> {
  const rows = await client<LegacyRow[]>`select * from ${client(table)};`;
  return rows;
}

function ensureId(prefix: string, possibleId: any): string {
  const base = possibleId != null ? String(possibleId) : randomUUID();
  return `${prefix}:${base}`;
}

async function buildNameToDepartmentId(
  db: Awaited<ReturnType<typeof getDatabase>>
): Promise<NameToIdMap> {
  const existing = await db.select().from(departmentsTable);
  const map: NameToIdMap = new Map();
  for (const d of existing) map.set(toKey(d.name as string), d.id);
  return map;
}

async function buildNameToPositionId(
  db: Awaited<ReturnType<typeof getDatabase>>
): Promise<NameToIdMap> {
  const existing = await db.select().from(positionsTable);
  const map: NameToIdMap = new Map();
  for (const p of existing) map.set(toKey(p.name as string), p.id);
  return map;
}

async function upsertDepartment(
  db: Awaited<ReturnType<typeof getDatabase>>,
  cache: NameToIdMap,
  name: string
): Promise<string> {
  const key = toKey(name);
  if (!key) throw new Error('Department name is empty');
  const existingId = cache.get(key);
  if (existingId) return existingId;
  const id = ensureId('legacy-dept', key);
  await db.insert(departmentsTable).values({ id, name }).onConflictDoNothing();
  cache.set(key, id);
  return id;
}

async function upsertPosition(
  db: Awaited<ReturnType<typeof getDatabase>>,
  cache: NameToIdMap,
  name: string,
  departmentId: string
): Promise<string> {
  const key = toKey(name);
  if (!key) throw new Error('Position name is empty');
  const existingId = cache.get(key);
  if (existingId) return existingId;
  const id = ensureId('legacy-pos', key);
  await db.insert(positionsTable).values({ id, name, departmentId }).onConflictDoNothing();
  cache.set(key, id);
  return id;
}

async function main() {
  const dryRun = (process.env.DRY_RUN || '').toLowerCase() === 'true' || process.argv.includes('--dry-run');
  const appUrl = process.env.DATABASE_URL; // optional override for getDatabase
  let legacyUrl = process.env.LEGACY_DATABASE_URL || '';

  if (!legacyUrl && appUrl) {
    // Derive legacy URL from the app URL by swapping the db name to showcall_import
    try {
      const u = new URL(appUrl);
      u.pathname = '/showcall_import';
      legacyUrl = u.toString();
    } catch {
      // fall through to default
    }
  }

  if (!legacyUrl) {
    // Final fallback (likely not correct for system Postgres, but usable in embedded local dev)
    legacyUrl = 'postgresql://postgres:password@localhost:5432/showcall_import';
  }

  if (!legacyUrl) {
    throw new Error('LEGACY_DATABASE_URL is required');
  }

  const options: ImportOptions = { dryRun, legacyUrl, appUrl };
  const stats: ImportStats = {
    departmentsInserted: 0,
    positionsInserted: 0,
    employeesInserted: 0,
    employeePositionsInserted: 0,
    areasInserted: 0,
    schedulesInserted: 0,
    shiftsInserted: 0,
    eventsInserted: 0,
    eventAreasInserted: 0,
    seriesInserted: 0,
    seriesRulesInserted: 0,
    seriesAreasInserted: 0,
    inventoryItemsInserted: 0,
    assetSpecsInserted: 0,
    locationsInserted: 0,
    inventoryTxnsInserted: 0,
    reservationsInserted: 0,
    policiesInserted: 0,
    unitConversionsInserted: 0,
    valuationAvgInserted: 0,
    warnings: [],
  };

  const legacy = await connectLegacy(options.legacyUrl);

  try {
    // Locate legacy tables, prefer exact matches first
    const allTables = await listTables(legacy);
    const findExact = (name: string): string | null => {
      for (const t of allTables) {
        if (toKey(t) === toKey(name)) return t;
      }
      return null;
    };

    const deptTable =
      findExact('departments') ||
      (await findCandidateTable(legacy, { nameIncludes: ['department', 'dept'] })) ||
      null;
    const employeeTable =
      findExact('employees') ||
      (await findCandidateTable(legacy, {
        nameIncludes: ['employee', 'staff', 'person', 'people', 'user'],
        columnsAny: ['first_name', 'firstname', 'last_name', 'lastname', 'name', 'email'],
      })) ||
      null;
    const positionTable =
      findExact('positions') ||
      (await findCandidateTable(legacy, { nameIncludes: ['position', 'role', 'title'] })) ||
      null;
    const areasTableName =
      findExact('areas') || (await findCandidateTable(legacy, { nameIncludes: ['area'] })) || null;
    const schedulesTableName =
      findExact('schedules') || (await findCandidateTable(legacy, { nameIncludes: ['schedule'] })) || null;
    const shiftsTableName =
      findExact('shifts') || (await findCandidateTable(legacy, { nameIncludes: ['shift'] })) || null;
    const eventsTableName =
      findExact('events') || (await findCandidateTable(legacy, { nameIncludes: ['event'] })) || null;
    const eventAreasTableName =
      findExact('event_areas') || (await findCandidateTable(legacy, { nameIncludes: ['event_area'] })) || null;
    const seriesTableName =
      findExact('event_series') || (await findCandidateTable(legacy, { nameIncludes: ['series'] })) || null;
    const seriesRulesTableName =
      findExact('event_series_rules') || (await findCandidateTable(legacy, { nameIncludes: ['rule'] })) || null;
    const seriesAreasTableName =
      findExact('event_series_areas') || (await findCandidateTable(legacy, { nameIncludes: ['series_area'] })) || null;

    // Inventory tables
    const itemTableName = findExact('item') || (await findCandidateTable(legacy, { nameIncludes: ['item'] })) || null;
    const assetSpecsTableName = findExact('asset_specs') || (await findCandidateTable(legacy, { nameIncludes: ['asset'] })) || null;
    const locationTableName = findExact('location') || (await findCandidateTable(legacy, { nameIncludes: ['location'] })) || null;
    const inventoryTxnTableName = findExact('inventory_txn') || (await findCandidateTable(legacy, { nameIncludes: ['inventory', 'txn'] })) || null;
    const reservationTableName = findExact('reservation') || (await findCandidateTable(legacy, { nameIncludes: ['reservation'] })) || null;
    const policyTableName = findExact('policy') || (await findCandidateTable(legacy, { nameIncludes: ['policy'] })) || null;
    const unitConvTableName = findExact('unit_conversion') || (await findCandidateTable(legacy, { nameIncludes: ['conversion'] })) || null;
    const valuationAvgTableName = findExact('valuation_avg') || (await findCandidateTable(legacy, { nameIncludes: ['valuation'] })) || null;

    console.log('Discovered legacy tables:', { deptTable, employeeTable, positionTable, areasTableName, schedulesTableName, shiftsTableName, eventsTableName, eventAreasTableName, seriesTableName, seriesRulesTableName, seriesAreasTableName, itemTableName, assetSpecsTableName, locationTableName, inventoryTxnTableName, reservationTableName, policyTableName, unitConvTableName, valuationAvgTableName });

    const legacyDepartments = deptTable ? await loadLegacyRows(legacy, deptTable) : [];
    const legacyEmployees = employeeTable ? await loadLegacyRows(legacy, employeeTable) : [];
    const legacyPositions = positionTable ? await loadLegacyRows(legacy, positionTable) : [];
    const legacyAreas = areasTableName ? await loadLegacyRows(legacy, areasTableName) : [];
    const legacySchedules = schedulesTableName ? await loadLegacyRows(legacy, schedulesTableName) : [];
    const legacyShifts = shiftsTableName ? await loadLegacyRows(legacy, shiftsTableName) : [];
    const legacyEvents = eventsTableName ? await loadLegacyRows(legacy, eventsTableName) : [];
    const legacyEventAreas = eventAreasTableName ? await loadLegacyRows(legacy, eventAreasTableName) : [];
    const legacySeries = seriesTableName ? await loadLegacyRows(legacy, seriesTableName) : [];
    const legacySeriesRules = seriesRulesTableName ? await loadLegacyRows(legacy, seriesRulesTableName) : [];
    const legacySeriesAreas = seriesAreasTableName ? await loadLegacyRows(legacy, seriesAreasTableName) : [];
    const legacyItems = itemTableName ? await loadLegacyRows(legacy, itemTableName) : [];
    const legacyAssetSpecs = assetSpecsTableName ? await loadLegacyRows(legacy, assetSpecsTableName) : [];
    const legacyLocations = locationTableName ? await loadLegacyRows(legacy, locationTableName) : [];
    const legacyInventoryTxn = inventoryTxnTableName ? await loadLegacyRows(legacy, inventoryTxnTableName) : [];
    const legacyReservations = reservationTableName ? await loadLegacyRows(legacy, reservationTableName) : [];
    const legacyPolicies = policyTableName ? await loadLegacyRows(legacy, policyTableName) : [];
    const legacyUnitConversions = unitConvTableName ? await loadLegacyRows(legacy, unitConvTableName) : [];
    const legacyValuationAvg = valuationAvgTableName ? await loadLegacyRows(legacy, valuationAvgTableName) : [];

    await withTransaction(async (db) => {
      const nameToDeptId = await buildNameToDepartmentId(db);
      const nameToPosId = await buildNameToPositionId(db);
      const legacyDeptIdToNew = new Map<string, string>();
      const legacyItemIdToNew = new Map<string, string>();
      const legacyLocationIdToNew = new Map<string, string>();

      // 1) Departments (from legacy table, else derive from employee department fields)
      if (legacyDepartments.length) {
        for (const r of legacyDepartments) {
          const name = pick(r, ['name', 'department', 'dept_name', 'title']);
          if (!name) continue;
          const legacyId = pick(r, ['id', 'department_id', 'dept_id']);
          const id = await upsertDepartment(db, nameToDeptId, String(name).trim());
          if (legacyId) legacyDeptIdToNew.set(String(legacyId), id);
          if (!options.dryRun) stats.departmentsInserted += 1;
        }
      } else {
        const deptNames: Set<string> = new Set(
          legacyDepartments
            .map((r) => pick(r, ['name', 'department', 'dept_name', 'title']))
            .filter(Boolean)
            .map((v) => String(v).trim())
        );
        if (!deptNames.size) {
          for (const r of legacyEmployees) {
            const d = pick(r, ['department', 'dept', 'division', 'team']);
            if (d) deptNames.add(String(d).trim());
          }
        }
        for (const name of deptNames) {
          if (!name) continue;
          const id = await upsertDepartment(db, nameToDeptId, name);
          if (!options.dryRun) stats.departmentsInserted += 1;
        }
      }

      // Ensure an Unknown department exists if needed
      const unknownDeptId = await upsertDepartment(db, nameToDeptId, 'Unknown');

      // 2) Positions
      const posTuples: Array<{ name: string; departmentName?: string }> = [];
      for (const r of legacyPositions) {
        const name = pick(r, ['name', 'position', 'role', 'title']);
        const deptName = pick(r, ['department', 'dept']);
        if (name) posTuples.push({ name: String(name).trim(), departmentName: deptName ? String(deptName).trim() : undefined });
      }
      if (!posTuples.length) {
        for (const r of legacyEmployees) {
          const list = splitMulti(pick(r, ['position', 'positions', 'role', 'roles', 'title']));
          const deptName = pick(r, ['department', 'dept']);
          for (const p of list) posTuples.push({ name: p, departmentName: deptName ? String(deptName).trim() : undefined });
        }
      }
      for (const { name, departmentName } of posTuples) {
        if (!name) continue;
        const deptId = departmentName ? nameToDeptId.get(toKey(departmentName)) || unknownDeptId : unknownDeptId;
        if (!options.dryRun) {
          const id = await upsertPosition(db, nameToPosId, name, deptId);
          if (id) stats.positionsInserted += 1;
        }
      }

      // 3) Employees and employee_positions
      for (const r of legacyEmployees) {
        const legacyId = pick(r, ['id', 'employee_id', 'emp_id']);
        const firstName = pick(r, ['first_name', 'firstname', 'given_name', 'first']);
        const lastName = pick(r, ['last_name', 'lastname', 'surname', 'last']);
        const fullName = pick(r, ['name', 'full_name', 'display_name']);
        const email = pick(r, ['email', 'email_address']);
        const phone = pick(r, ['phone', 'primary_phone', 'mobile', 'cell']);
        const address1 = pick(r, ['address1', 'address_1', 'address', 'street1']);
        const address2 = pick(r, ['address2', 'address_2', 'street2']);
        const city = pick(r, ['city', 'town']);
        const state = pick(r, ['state', 'province', 'region']);
        const postalCode = pick(r, ['postal_code', 'zip', 'zipcode', 'post_code']);
        const postalCode4 = pick(r, ['zip4', 'postal_code4']);
        const priority = pick(r, ['priority', 'rank']);
        const deptName = pick(r, ['department', 'dept', 'division', 'team']);

        const departmentId = deptName ? nameToDeptId.get(toKey(String(deptName))) || unknownDeptId : unknownDeptId;

        const composedName = fullName
          ? String(fullName)
          : [firstName, lastName].filter(Boolean).map(String).join(' ').trim();

        if (!composedName) {
          stats.warnings.push(`Skipped employee with missing name (legacy id: ${legacyId ?? 'n/a'})`);
          continue;
        }

        const employeeId = ensureId('legacy-emp', legacyId ?? composedName);

        if (!options.dryRun) {
          await db.insert(employeesTable).values({
            id: employeeId,
            departmentId,
            name: composedName,
            priority: priority != null ? Number(priority) : null as any,
            firstName: firstName ? String(firstName) : null as any,
            lastName: lastName ? String(lastName) : null as any,
            address1: address1 ? String(address1) : null as any,
            address2: address2 ? String(address2) : null as any,
            city: city ? String(city) : null as any,
            state: state ? String(state) : null as any,
            postalCode: postalCode ? String(postalCode) : null as any,
            postalCode4: postalCode4 ? String(postalCode4) : null as any,
            primaryPhone: phone ? String(phone) : null as any,
            email: email ? String(email) : null as any,
          }).onConflictDoNothing();
          stats.employeesInserted += 1;
        }

        const empPositions = splitMulti(pick(r, ['position', 'positions', 'role', 'roles', 'title']));
        for (const posName of empPositions) {
          const posId = await upsertPosition(db, nameToPosId, posName, departmentId);
          const joinId = ensureId('legacy-emp-pos', `${employeeId}-${posId}`);
          if (!options.dryRun) {
            await db.insert(employeePositionsTable).values({
              id: joinId,
              departmentId,
              employeeId,
              positionId: posId,
              priority: null as any,
              isLead: false,
            }).onConflictDoNothing();
            stats.employeePositionsInserted += 1;
          }
        }
      }

      // 4) Areas
      for (const a of legacyAreas) {
        const id = ensureId('legacy-area', pick(a, ['id', 'area_id', 'uuid']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(areasTable).values({
            id,
            name: String(pick(a, ['name', 'title']) ?? 'Unnamed Area'),
            description: asString(pick(a, ['description', 'desc'])),
            color: asString(pick(a, ['color'])),
            active: asBool(pick(a, ['active', 'is_active'])) ?? true,
            sortOrder: Number(pick(a, ['sort_order', 'sort', 'order']) ?? 0),
          }).onConflictDoNothing();
          stats.areasInserted += 1;
        }
      }

      // 5) Schedules
      for (const s of legacySchedules) {
        const id = ensureId('legacy-sched', pick(s, ['id', 'schedule_id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(schedulesTable).values({
            id,
            name: String(pick(s, ['name', 'title']) ?? 'Schedule'),
            startDate: normalizeDate(pick(s, ['start_date', 'start']) ?? pick(s, ['date'])),
            endDate: normalizeDate(pick(s, ['end_date', 'end']) ?? pick(s, ['date'])),
            isPublished: asBool(pick(s, ['is_published', 'published'])) ?? false,
          }).onConflictDoNothing();
          stats.schedulesInserted += 1;
        }
      }

      // 6) Events
      for (const ev of legacyEvents) {
        const id = ensureId('legacy-ev', pick(ev, ['id', 'event_id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(eventsTable).values({
            id,
            title: String(pick(ev, ['title', 'name']) ?? 'Event'),
            promoter: asString(pick(ev, ['promoter'])),
            status: String(pick(ev, ['status']) ?? 'scheduled'),
            date: normalizeDate(pick(ev, ['date'])),
            startTime: normalizeTime(pick(ev, ['start_time', 'start']) ?? '00:00'),
            endTime: normalizeTime(pick(ev, ['end_time', 'end']) ?? '23:59'),
            description: asString(pick(ev, ['description', 'desc'])),
            artists: asString(pick(ev, ['artists'])),
            ticketUrl: asString(pick(ev, ['ticket_url'])),
            eventPageUrl: asString(pick(ev, ['event_page_url'])),
            promoAssetsUrl: asString(pick(ev, ['promo_assets_url'])),
            seriesId: asString(pick(ev, ['series_id'])),
          }).onConflictDoNothing();
          stats.eventsInserted += 1;
        }
      }

      // 7) Event Areas
      for (const ea of legacyEventAreas) {
        const eventId = ensureId('legacy-ev', pick(ea, ['event_id']));
        const areaId = ensureId('legacy-area', pick(ea, ['area_id']));
        if (!options.dryRun) {
          await db.insert(eventAreasTable).values({ eventId, areaId }).onConflictDoNothing({ target: [eventAreasTable.eventId, eventAreasTable.areaId] });
          stats.eventAreasInserted += 1;
        }
      }

      // 8) Recurring Series
      for (const s of legacySeries) {
        const id = ensureId('legacy-series', pick(s, ['id', 'series_id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(eventSeriesTable).values({
            id,
            name: String(pick(s, ['name', 'title']) ?? 'Series'),
            description: asString(pick(s, ['description', 'desc'])),
            startDate: asString(pick(s, ['start_date'])),
            endDate: asString(pick(s, ['end_date'])),
            defaultStatus: String(pick(s, ['default_status']) ?? 'planned'),
            defaultStartTime: String(pick(s, ['default_start_time']) ?? '00:00'),
            defaultEndTime: String(pick(s, ['default_end_time']) ?? '23:59'),
            titleTemplate: asString(pick(s, ['title_template'])),
            promoterTemplate: asString(pick(s, ['promoter_template'])),
            artistsTemplate: asString(pick(s, ['artists_template'])),
            templateJson: safeJson(pick(s, ['template_json'])),
          }).onConflictDoNothing();
          stats.seriesInserted += 1;
        }
      }

      for (const r of legacySeriesRules) {
        const id = ensureId('legacy-series-rule', pick(r, ['id', 'rule_id']) ?? randomUUID());
        const seriesId = ensureId('legacy-series', pick(r, ['series_id']));
        if (!options.dryRun) {
          await db.insert(eventSeriesRulesTable).values({
            id,
            seriesId,
            frequency: String(pick(r, ['frequency']) ?? 'weekly'),
            interval: Number(pick(r, ['interval']) ?? 1),
            byWeekdayMask: Number(pick(r, ['by_weekday_mask']) ?? 0),
          }).onConflictDoNothing();
          stats.seriesRulesInserted += 1;
        }
      }

      for (const sa of legacySeriesAreas) {
        const seriesId = ensureId('legacy-series', pick(sa, ['series_id']));
        const areaId = ensureId('legacy-area', pick(sa, ['area_id']));
        if (!options.dryRun) {
          await db.insert(eventSeriesAreasTable).values({ seriesId, areaId }).onConflictDoNothing({ target: [eventSeriesAreasTable.seriesId, eventSeriesAreasTable.areaId] });
          stats.seriesAreasInserted += 1;
        }
      }

      // 9) Shifts (after schedules/events)
      for (const sh of legacyShifts) {
        const id = ensureId('legacy-shift', pick(sh, ['id', 'shift_id']) ?? randomUUID());
        const maybeDept = pick(sh, ['department_id']);
        const departmentId = maybeDept ? (legacyDeptIdToNew.get(String(maybeDept)) || unknownDeptId) : unknownDeptId;
        const scheduleId = pick(sh, ['schedule_id']) ? ensureId('legacy-sched', pick(sh, ['schedule_id'])) : null;
        const eventId = pick(sh, ['event_id']) ? ensureId('legacy-ev', pick(sh, ['event_id'])) : null;
        if (!options.dryRun) {
          await db.insert(shiftsTable).values({
            id,
            departmentId,
            scheduleId: scheduleId as any,
            date: normalizeDate(pick(sh, ['date'])),
            startTime: normalizeTime(pick(sh, ['start_time', 'start'])),
            endTime: normalizeTime(pick(sh, ['end_time', 'end'])),
            title: asString(pick(sh, ['title', 'name'])),
            notes: asString(pick(sh, ['notes', 'description'])),
            eventId: eventId as any,
          }).onConflictDoNothing();
          stats.shiftsInserted += 1;
        }
      }

      // 10) Inventory
      // 10a) Ensure attribute schemas exist for referenced schema_ids
      if (legacyItems.length) {
        const schemaIdToType = new Map<string, string>();
        for (const it of legacyItems) {
          const legacySchema = pick(it, ['schema_id']);
          if (!legacySchema) continue;
          const sid = coerceUuid(legacySchema);
          const itemType = String(pick(it, ['item_type', 'type']) ?? 'generic');
          if (!schemaIdToType.has(sid)) schemaIdToType.set(sid, itemType);
        }
        for (const [sid, itemType] of schemaIdToType) {
          if (!options.dryRun) {
            await db.insert(attributeSchema).values({
              schemaId: sid as any,
              itemType,
              departmentId: null as any,
              version: 1,
              jsonSchema: {},
            }).onConflictDoNothing();
          }
        }
      }
      for (const it of legacyItems) {
        const legacyId = pick(it, ['item_id', 'id']) ?? randomUUID();
        const itemId = coerceUuid(legacyId);
        if (!options.dryRun) {
          await db.insert(inventoryItems).values({
            itemId,
            sku: String(pick(it, ['sku', 'code']) ?? itemId),
            name: String(pick(it, ['name', 'title']) ?? 'Item'),
            itemType: String(pick(it, ['item_type', 'type']) ?? 'generic'),
            baseUnit: String(pick(it, ['base_unit', 'unit']) ?? 'ea'),
            categoryId: asString(pick(it, ['category_id'])) as any,
            schemaId: coerceUuid(pick(it, ['schema_id']) ?? randomUUID()) as any,
            attributes: safeJson(pick(it, ['attributes'])) ?? {},
            active: asBool(pick(it, ['active'])) ?? true,
          }).onConflictDoNothing();
          stats.inventoryItemsInserted += 1;
        }
        legacyItemIdToNew.set(String(legacyId), itemId);
      }

      for (const as of legacyAssetSpecs) {
        const itemId = legacyItemIdToNew.get(String(pick(as, ['item_id']))) || coerceUuid(pick(as, ['item_id']));
        if (!options.dryRun) {
          await db.insert(assetSpecs).values({
            itemId: itemId as any,
            requiresSerial: asBool(pick(as, ['requires_serial'])) ?? true,
            serviceIntervalDays: Number(pick(as, ['service_interval_days']) ?? 0),
          }).onConflictDoNothing();
          stats.assetSpecsInserted += 1;
        }
      }

      for (const loc of legacyLocations) {
        const locationId = ensureId('legacy-location', pick(loc, ['location_id', 'id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(locations).values({
            locationId: locationId as any,
            name: String(pick(loc, ['name', 'title']) ?? 'Location'),
            departmentId: ((): any => {
              const maybe = pick(loc, ['department_id']);
              if (!maybe) return unknownDeptId as any;
              const mapped = nameToDeptId.get(toKey(String(maybe)));
              return (mapped || (String(maybe).startsWith('legacy-dept:') ? String(maybe) : unknownDeptId)) as any;
            })(),
          }).onConflictDoNothing();
          stats.locationsInserted += 1;
        }
        legacyLocationIdToNew.set(String(pick(loc, ['location_id', 'id']) ?? locationId), locationId);
      }

      for (const tx of legacyInventoryTxn) {
        const txnId = coerceUuid(pick(tx, ['txn_id', 'id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(inventoryTxn).values({
            txnId: txnId as any,
            itemId: (legacyItemIdToNew.get(String(pick(tx, ['item_id']))) || coerceUuid(pick(tx, ['item_id']))) as any,
            locationId: (legacyLocationIdToNew.get(String(pick(tx, ['location_id']))) || coerceUuid(pick(tx, ['location_id']))) as any,
            eventType: String(pick(tx, ['event_type', 'type']) ?? 'adjust'),
            qtyBase: String(pick(tx, ['qty_base', 'qty']) ?? '0') as any,
            lotId: asString(pick(tx, ['lot_id'])) as any,
            serialNo: asString(pick(tx, ['serial_no'])) as any,
            costPerBase: asString(pick(tx, ['cost_per_base'])) as any,
            sourceDoc: safeJson(pick(tx, ['source_doc'])),
            postedBy: ensureId('legacy-user', pick(tx, ['posted_by']) ?? 'system') as any,
          }).onConflictDoNothing();
          stats.inventoryTxnsInserted += 1;
        }
      }

      for (const rs of legacyReservations) {
        const resId = coerceUuid(pick(rs, ['res_id', 'id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(reservations).values({
            resId: resId as any,
            itemId: (legacyItemIdToNew.get(String(pick(rs, ['item_id']))) || coerceUuid(pick(rs, ['item_id']))) as any,
            locationId: (legacyLocationIdToNew.get(String(pick(rs, ['location_id']))) || coerceUuid(pick(rs, ['location_id']))) as any,
            eventId: ensureId('legacy-ev', pick(rs, ['event_id'])) as any,
            qtyBase: String(pick(rs, ['qty_base', 'qty']) ?? '0') as any,
            startTs: normalizeTimestamp(pick(rs, ['start_ts', 'start'])) as any,
            endTs: normalizeTimestamp(pick(rs, ['end_ts', 'end'])) as any,
            status: String(pick(rs, ['status']) ?? 'pending'),
          }).onConflictDoNothing();
          stats.reservationsInserted += 1;
        }
      }

      for (const pol of legacyPolicies) {
        const policyId = ensureId('legacy-policy', pick(pol, ['policy_id', 'id']) ?? randomUUID());
        if (!options.dryRun) {
          await db.insert(policies).values({
            policyId: policyId as any,
            departmentId: ensureId('legacy-dept', pick(pol, ['department_id'])) as any,
            itemType: String(pick(pol, ['item_type', 'type']) ?? 'generic'),
            key: String(pick(pol, ['key']) ?? 'default'),
            value: safeJson(pick(pol, ['value'])) ?? {},
          }).onConflictDoNothing();
          stats.policiesInserted += 1;
        }
      }

      for (const uc of legacyUnitConversions) {
        if (!options.dryRun) {
          await db.insert(unitConversions).values({
            fromUnit: String(pick(uc, ['from_unit'])),
            toUnit: String(pick(uc, ['to_unit'])),
            factor: String(pick(uc, ['factor']) ?? '1') as any,
          }).onConflictDoNothing();
          stats.unitConversionsInserted += 1;
        }
      }

      for (const va of legacyValuationAvg) {
        const itemId = ensureId('legacy-item', pick(va, ['item_id']));
        if (!options.dryRun) {
          await db.insert(valuationAvg).values({
            itemId: itemId as any,
            avgCost: String(pick(va, ['avg_cost']) ?? '0') as any,
            qtyBase: String(pick(va, ['qty_base']) ?? '0') as any,
          }).onConflictDoNothing();
          stats.valuationAvgInserted += 1;
        }
      }
    }, appUrl);

    console.log('Import complete', { dryRun: options.dryRun, stats });
    if (stats.warnings.length) {
      console.warn('Warnings:');
      for (const w of stats.warnings) console.warn(' -', w);
    }
    if (options.dryRun) {
      console.log('Dry run mode: no changes were written. Re-run without --dry-run or DRY_RUN=true to apply.');
    }
  } finally {
    await legacy.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('Legacy import failed:', err);
  process.exitCode = 1;
});

