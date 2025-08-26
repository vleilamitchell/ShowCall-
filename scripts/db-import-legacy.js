#!/usr/bin/env node

// Wrapper script: delegate legacy import to the robust server importer (server/src/scripts/import-legacy.ts)
// Ensures employees have correct department assignments and employee_positions are created with department
// context, and imports recurring series when present.

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

function getDefaultBaseUrl() {
  const port = getEmbeddedPort() || 5502;
  return `postgresql://postgres:password@localhost:${port}/postgres`;
}

function getUrlOrDefault(envVar, fallback) {
  const v = process.env[envVar];
  if (v && v.startsWith('postgres')) return v;
  return fallback;
}

function withDbName(url, name) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { execute: false };
  for (const a of args) if (a === '--execute') opts.execute = true;
  return opts;
}

async function main() {
  const { execute } = parseArgs();
  const base = getDefaultBaseUrl();
  const activeUrl = getUrlOrDefault('ACTIVE_DATABASE_URL', process.env.DATABASE_URL || base);
  const importUrl = withDbName(getUrlOrDefault('IMPORT_DATABASE_URL', base), 'showcall_import');

  const env = {
    ...process.env,
    DATABASE_URL: activeUrl,
    LEGACY_DATABASE_URL: importUrl,
    DRY_RUN: execute ? 'false' : 'true',
  };

  console.log(`Legacy import via server importer (${execute ? 'EXECUTE' : 'DRY-RUN'})`);
  console.log(`Source: ${importUrl}`);
  console.log(`Target: ${activeUrl}`);

  const res = spawnSync('pnpm', ['-C', 'server', 'run', 'import:legacy', ...(execute ? [] : ['--', '--dry-run'])], { stdio: 'inherit', env });
  if (res.status !== 0) process.exit(res.status || 1);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });
