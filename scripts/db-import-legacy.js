#!/usr/bin/env node

// Import data from legacy database `showcall_import` into the active database
// - Detects embedded Postgres port from data dir (postmaster.opts) or uses env URLs
// - Provides dry-run planning and execute modes
// - Performs inserts in FK-safe order with best-effort column mapping
// - Focus on critical entities from prompt: inventory items, events, recurring events,
//   schedules, shifts, assignments, positions, contacts, employees, departments, areas

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function getEmbeddedPort() {
  const optsPath = path.resolve(process.cwd(), 'data/postgres/postmaster.opts');
  try {
    const content = fs.readFileSync(optsPath, 'utf8');
    const match = content.match(/-p"?\s+"?(\d{4,5})/);
    if (match) return parseInt(match[1], 10);
  } catch {}
  return undefined;
}

function buildDbUrlParts(baseUrl) {
  const u = new URL(baseUrl);
  return {
    protocol: u.protocol,
    username: u.username,
    password: u.password,
    hostname: u.hostname,
    port: u.port,
  };
}

function getDefaultBaseUrl() {
  const port = getEmbeddedPort() || 5502;
  return `postgresql://postgres:password@localhost:${port}/postgres`;
}

function getUrlOrDefault(envVar, defaultUrl) {
  const val = process.env[envVar];
  if (val && val.startsWith('postgres')) return val;
  return defaultUrl;
}

function withDbName(dbUrl, dbName) {
  const u = new URL(dbUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function resolvePsql() {
  const brewPrefix = spawnSync('brew', ['--prefix', 'postgresql@17'], { encoding: 'utf8' });
  if (brewPrefix.status === 0) {
    const prefix = brewPrefix.stdout.trim();
    const psqlPath = path.join(prefix, 'bin/psql');
    if (fs.existsSync(psqlPath)) return psqlPath;
  }
  const which = spawnSync('which', ['psql'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.trim();
  return null;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function quoteIdent(ident) {
  return '"' + ident.replace(/"/g, '""') + '"';
}

function literal(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeColor(val) {
  if (val === null || val === undefined) return null;
  let s = String(val).trim().toLowerCase();
  if (!s) return null;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^#([0-9a-f]{3})$/.test(s)) {
    const m = s.match(/^#([0-9a-f]{3})$/);
    const h = m[1];
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (/^#([0-9a-f]{6})$/.test(s)) return s;
  // Fallback: return as-is (could be css name); downstream can handle if desired
  return s;
}

function fetchDepartmentsMap(psql, url) {
  const out = run(psql, ['--no-psqlrc', '-A', '-t', '-F', '\t', `--dbname=${url}`, '-c', 'SELECT id, name FROM "departments"']);
  if (out.status !== 0) return { idToName: new Map(), nameToId: new Map() };
  const idToName = new Map();
  const nameToId = new Map();
  const lines = out.stdout.trim().split('\n').filter(Boolean);
  for (const ln of lines) {
    const [id, name] = ln.split('\t');
    if (id) idToName.set(id, name || '');
    if (name) nameToId.set((name || '').trim().toLowerCase(), id);
  }
  return { idToName, nameToId };
}

function ensureUnassignedDepartment(psql, url) {
  const unassignedId = 'dept:unassigned';
  const check = run(psql, ['--no-psqlrc', '-A', '-t', `--dbname=${url}`, '-c', `SELECT 1 FROM "departments" WHERE id=${literal(unassignedId)} LIMIT 1`]);
  if (check.status === 0 && check.stdout.trim()) return unassignedId;
  const ins = execSql(psql, url, `INSERT INTO "departments" (id, name) VALUES (${literal(unassignedId)}, 'Unassigned') ON CONFLICT (id) DO NOTHING;`);
  if (ins.status !== 0) {
    // If insert failed, still return id so caller can use it
    return unassignedId;
  }
  return unassignedId;
}

function mapDepartmentId(raw, deptMaps, fallbackId) {
  let v = raw == null ? '' : String(raw).trim();
  if (!v) return fallbackId;
  // direct id match
  if (deptMaps.idToName.has(v)) return v;
  // case-insensitive id match
  for (const id of deptMaps.idToName.keys()) {
    if (id.toLowerCase() === v.toLowerCase()) return id;
  }
  // strip legacy prefix and try name
  let candidate = v;
  if (v.startsWith('legacy-dept:')) candidate = v.split(':').slice(1).join(':');
  const byName = deptMaps.nameToId.get(candidate.toLowerCase());
  if (byName) return byName;
  return fallbackId;
}

function parseArgv() {
  const args = process.argv.slice(2);
  const opts = { execute: false, tables: null, batchSize: 1000 };
  for (const a of args) {
    if (a === '--execute') opts.execute = true;
    else if (a.startsWith('--tables=')) opts.tables = a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--batch=')) opts.batchSize = parseInt(a.split('=')[1], 10) || opts.batchSize;
  }
  return opts;
}

function info(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }
function error(msg) { console.error(msg); }

function fetchRows(psql, url, sql) {
  const out = run(psql, ['--no-psqlrc', '-A', '-F', '\t', `--dbname=${url}`, '-c', sql]);
  if (out.status !== 0) {
    throw new Error(out.stderr || 'Query failed');
  }
  const lines = out.stdout.trim().split('\n').filter(Boolean);
  // First line may include headers if not set; enforce tuples only
  // Use COPY ... TO STDOUT for robust fetch
  return lines;
}

function copyOut(psql, url, sql) {
  // Returns TSV data string
  const out = run(psql, ['--no-psqlrc', `--dbname=${url}`, '-c', sql]);
  if (out.status !== 0) {
    throw new Error(out.stderr || 'COPY failed');
  }
  return out.stdout;
}

function execSql(psql, url, sql) {
  const out = run(psql, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', `--dbname=${url}`, '-c', sql]);
  return out;
}

function planner() {
  // Defines the ordered entity import plan and column mappings
  // Left side: legacy source table name, Right side: active target table name + columns mapping
  // Adjust as needed; many columns may align by name already
  return [
    { source: 'departments', target: 'departments', key: 'id', map: { id: 'id', name: 'name' } },
    { source: 'areas', target: 'areas', key: 'id', map: { id: 'id', department_id: 'department_id', name: 'name', description: 'description', color: 'color' } },
    { source: 'positions', target: 'positions', key: 'id', map: { id: 'id', department_id: 'department_id', name: 'name' } },
    { source: 'contacts', target: 'contacts', key: 'id', map: { id: 'id', name: 'name', email: 'email', phone: 'phone' } },
    { source: 'employees', target: 'employees', key: 'id', map: {
      id: 'id', department_id: 'department_id', name: 'name', priority: 'priority', first_name: 'first_name', middle_name: 'middle_name', last_name: 'last_name',
      address1: 'address1', address2: 'address2', city: 'city', state: 'state', postal_code: 'postal_code', postal_code4: 'postal_code4', primary_phone: 'primary_phone', email: 'email',
      emergency_contact_name: 'emergency_contact_name', emergency_contact_phone: 'emergency_contact_phone'
    } },
    { source: 'events', target: 'events', key: 'id', map: {
      id: 'id', title: 'title', promoter: 'promoter', status: 'status', date: 'date', start_time: 'start_time', end_time: 'end_time', description: 'description',
      artists: 'artists', ticket_url: 'ticket_url', event_page_url: 'event_page_url', promo_assets_url: 'promo_assets_url', series_id: 'series_id'
    } },
    // Event to Areas join table
    { source: 'event_areas', target: 'event_areas', key: 'event_id', map: { event_id: 'event_id', area_id: 'area_id' } },
    // Legacy recurring_series maps to new event_series
    { source: 'recurring_series', target: 'event_series', key: 'id', map: { id: 'id', name: 'name', description: 'description', start_date: 'start_date', end_date: 'end_date' } },
    { source: 'schedules', target: 'schedules', key: 'id', map: { id: 'id', department_id: 'department_id', name: 'name', notes: 'notes' } },
    { source: 'shifts', target: 'shifts', key: 'id', map: {
      id: 'id', department_id: 'department_id', schedule_id: 'schedule_id', date: 'date', start_time: 'start_time', end_time: 'end_time', title: 'title', notes: 'notes', event_id: 'event_id'
    } },
    { source: 'assignments', target: 'assignments', key: 'id', map: {
      id: 'id', department_id: 'department_id', shift_id: 'shift_id', required_position_id: 'required_position_id', assignee_employee_id: 'assignee_employee_id'
    } },
    // Inventory schema is different (items -> item); skip by default unless extended mapping is added
    // { source: 'inventory_items', target: 'item', key: 'id', map: { id: 'item_id', name: 'name', sku: 'sku' } },
  ];
}

function discoverColumns(psql, url, table) {
  const sql = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${literal(table)} ORDER BY ordinal_position;`;
  const out = run(psql, ['--no-psqlrc', '-A', '-t', `--dbname=${url}`, '-c', sql]);
  if (out.status !== 0) throw new Error(out.stderr || 'Column discovery failed');
  return out.stdout.trim().split('\n').filter(Boolean);
}

function countRows(psql, url, table) {
  const sql = `SELECT COUNT(*) FROM ${quoteIdent(table)};`;
  const out = run(psql, ['--no-psqlrc', '-A', '-t', `--dbname=${url}`, '-c', sql]);
  if (out.status !== 0) throw new Error(out.stderr || 'Count failed');
  return parseInt(out.stdout.trim(), 10) || 0;
}

function copyIds(psql, url, table, idColumn) {
  const sql = `COPY (SELECT ${quoteIdent(idColumn)} FROM ${quoteIdent(table)}) TO STDOUT WITH (FORMAT csv, HEADER false)`;
  const out = run(psql, ['--no-psqlrc', `--dbname=${url}`, '-c', sql]);
  if (out.status !== 0) throw new Error(out.stderr || 'COPY ids failed');
  return out.stdout.split('\n').filter(Boolean);
}

function buildInsertSql(targetTable, targetColumns, rows) {
  if (rows.length === 0) return null;
  const values = rows.map((r) => '(' + r.map((v) => literal(v)).join(', ') + ')').join(',\n');
  return `INSERT INTO ${quoteIdent(targetTable)} (${targetColumns.map(quoteIdent).join(', ')}) VALUES\n${values}\nON CONFLICT DO NOTHING;`;
}

function buildInsertSqlUpsert(targetTable, targetColumns, rows, upsertCols = []) {
  if (rows.length === 0) return null;
  const values = rows.map((r) => '(' + r.map((v) => literal(v)).join(', ') + ')').join(',\n');
  const base = `INSERT INTO ${quoteIdent(targetTable)} (${targetColumns.map(quoteIdent).join(', ')}) VALUES\n${values}`;
  if (!upsertCols || upsertCols.length === 0) return base + `\nON CONFLICT DO NOTHING;`;
  // Assume primary key column is 'id' exists in targetColumns
  const upserts = upsertCols
    .filter((c) => targetColumns.includes(c))
    .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
    .join(', ');
  return `${base}\nON CONFLICT (${quoteIdent('id')}) DO UPDATE SET ${upserts};`;
}

async function main() {
  const opts = parseArgv();
  const psql = resolvePsql();
  if (!psql) {
    error('psql not found. Please install PostgreSQL client tools (e.g., brew install postgresql@17).');
    process.exit(1);
  }

  const defaultBaseUrl = getDefaultBaseUrl();
  const importBase = getUrlOrDefault('IMPORT_DATABASE_URL', defaultBaseUrl);
  const activeBase = getUrlOrDefault('ACTIVE_DATABASE_URL', process.env.DATABASE_URL || defaultBaseUrl);

  const importUrl = withDbName(importBase, 'showcall_import');
  const activeDbName = new URL(activeBase).pathname.replace(/^\//, '') || 'postgres';
  const activeUrl = activeBase.includes('/') ? activeBase : withDbName(activeBase, activeDbName);

  const plan = planner().filter((p) => !opts.tables || opts.tables.includes(p.target) || opts.tables.includes(p.source));
  if (plan.length === 0) {
    warn('No tables selected to import. Use --tables=comma,separated or adjust planner().');
    process.exit(0);
  }

  info(`Legacy import plan (${opts.execute ? 'EXECUTE' : 'DRY-RUN'})`);
  info(`Source: ${importUrl}`);
  info(`Target: ${activeUrl}`);

  for (const step of plan) {
    const { source, target, key, map } = step;
    info(`\n➡️  Table: ${source} -> ${target}`);
    // Verify tables exist and discover columns in target
    try {
      const targetCols = discoverColumns(psql, activeUrl, target);
      const sourceCount = countRows(psql, importUrl, source);
      const targetCount = countRows(psql, activeUrl, target);
      info(`   Source count: ${sourceCount}, Target count: ${targetCount}`);

      const targetColsSet = new Set(targetCols);
      const pairs = Object.entries(map).filter(([srcCol, dstCol]) => targetColsSet.has(dstCol));
      let targetColumns = pairs.map(([, dst]) => dst);
      const sourceColumns = pairs.map(([src]) => src);

      // Add defaulted required columns per table when missing from mapping
      const additionalColumns = [];
      const additionalValues = [];
      if (target === 'schedules') {
        const today = todayIsoDate();
        if (!targetColumns.includes('start_date') && targetColsSet.has('start_date')) {
          additionalColumns.push('start_date');
          additionalValues.push(today);
        }
        if (!targetColumns.includes('end_date') && targetColsSet.has('end_date')) {
          additionalColumns.push('end_date');
          additionalValues.push(today);
        }
        // is_published has default false; we can rely on default
      }
      if (additionalColumns.length > 0) {
        targetColumns = targetColumns.concat(additionalColumns);
      }

      if (targetColumns.length === 0) {
        warn('   No overlapping columns between mapping and target; skipping.');
        continue;
      }

      // Extract source rows in batches to limit memory
      if (!opts.execute) {
        info(`   Columns mapped: ${sourceColumns.join(', ')} -> ${targetColumns.join(', ')}`);
        info(`   Would import up to ${sourceCount} rows (conflicts ignored).`);
        continue;
      }

      const batchSize = Math.max(1, opts.batchSize);
      // Use COPY to TSV then split; fallback to OFFSET when not possible
      let offset = 0;
      while (offset < sourceCount) {
        const batchSql = `SELECT ${sourceColumns.map((c) => quoteIdent(c)).join(', ')} FROM ${quoteIdent(source)} ORDER BY ${quoteIdent(key)} OFFSET ${offset} LIMIT ${batchSize}`;
        const out = run(psql, ['--no-psqlrc', '-A', '-t', '-F', '\t', `--dbname=${importUrl}`, '-c', batchSql]);
        if (out.status !== 0) {
          throw new Error(out.stderr || 'Failed to read batch');
        }
        let lines = out.stdout.trim() ? out.stdout.trim().split('\n') : [];
        // Guard: filter psql row-count footer if present
        lines = lines.filter((ln) => !/^\(\d+ rows?\)$/.test(ln.trim()));
        if (lines.length === 0) break;
        const expectedCols = sourceColumns.length;
        let rows = lines.map((ln) => {
          const cols = ln.split('\t').map((v) => (v === '' ? null : v));
          if (cols.length < expectedCols) {
            while (cols.length < expectedCols) cols.push(null);
          } else if (cols.length > expectedCols) {
            cols.length = expectedCols;
          }
          return cols;
        });
        // Append any additional defaulted values for required columns
        if (additionalColumns.length > 0) {
          rows = rows.map((r) => r.concat(additionalValues));
        }
        // Per-table row transformations
        if (target === 'areas') {
          // Normalize color hexes
          const colorIdx = targetColumns.indexOf('color');
          if (colorIdx !== -1) {
            rows = rows.map((r) => {
              r[colorIdx] = normalizeColor(r[colorIdx]);
              return r;
            });
          }
        }

        // Normalize department references
        if (targetColumns.includes('department_id') && ['areas', 'positions', 'employees', 'shifts', 'assignments'].includes(target)) {
          const deptIdx = targetColumns.indexOf('department_id');
          const deptMaps = fetchDepartmentsMap(psql, activeUrl);
          const fallbackDeptId = ensureUnassignedDepartment(psql, activeUrl);
          rows = rows.map((r) => {
            r[deptIdx] = mapDepartmentId(r[deptIdx], deptMaps, fallbackDeptId);
            return r;
          });
        }

        const sql = buildInsertSqlUpsert(target, targetColumns, rows, target === 'areas' ? ['color'] : []);
        if (sql) {
          const ins = execSql(psql, activeUrl, sql);
          if (ins.status !== 0) {
            error(ins.stderr || `Insert into ${target} failed`);
            process.exit(ins.status || 1);
          }
        }
        offset += rows.length;
        info(`   Inserted ${rows.length} rows into ${target} (offset ${offset}/${sourceCount})`);
      }
    } catch (e) {
      warn(`   Skipping due to error: ${e?.message || e}`);
    }
  }

  info(`\n${opts.execute ? '✅ Import completed.' : '📝 Dry run completed.'}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


