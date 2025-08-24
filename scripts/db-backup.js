#!/usr/bin/env node

// Simple Postgres backup script for Showcall
// - Detects embedded Postgres port from data dir (postmaster.opts) or uses DATABASE_URL
// - Uses Homebrew postgresql@17 pg_dump when available, otherwise falls back to system pg_dump
// - Writes timestamped SQL files to data/postgres/backups/

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

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('postgres')) return envUrl;
  const port = getEmbeddedPort() || 5502;
  return `postgresql://postgres:password@localhost:${port}/postgres`;
}

function resolvePgDump() {
  // Prefer Homebrew PostgreSQL 17
  const brewPrefix = spawnSync('brew', ['--prefix', 'postgresql@17'], { encoding: 'utf8' });
  if (brewPrefix.status === 0) {
    const prefix = brewPrefix.stdout.trim();
    const pgDumpPath = path.join(prefix, 'bin/pg_dump');
    if (fs.existsSync(pgDumpPath)) return pgDumpPath;
  }
  // Fallback to PATH
  const which = spawnSync('which', ['pg_dump'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.trim();
  return null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function main() {
  const dbUrl = getDatabaseUrl();
  const backupsDir = path.resolve(process.cwd(), 'data/postgres/backups');
  ensureDir(backupsDir);
  const outFile = path.join(backupsDir, `showcall_${timestamp()}.sql`);

  const pgDump = resolvePgDump();
  if (!pgDump) {
    console.error('pg_dump not found. Please install PostgreSQL client tools (e.g., brew install postgresql@17).');
    process.exit(1);
  }

  const args = ['--no-owner', '--no-privileges', '--format=plain', `--dbname=${dbUrl}`];
  const result = spawnSync(pgDump, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || 'pg_dump failed');
    // If version mismatch, hint
    if ((result.stderr || '').includes('server version') && (result.stderr || '').includes('pg_dump version')) {
      console.error('Detected version mismatch. On macOS, install matching client: brew install postgresql@17');
    }
    process.exit(result.status || 1);
  }

  fs.writeFileSync(outFile, result.stdout, 'utf8');
  console.log(outFile);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


