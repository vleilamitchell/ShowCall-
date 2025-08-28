#!/usr/bin/env node

// Import latest SQL backup into a target database
// - Detects embedded Postgres port from data dir (postmaster.opts) or uses DATABASE_URL
// - Uses Homebrew postgresql@17 psql when available, otherwise falls back to system psql
// - By default, imports into the database from DATABASE_URL when it's not "postgres".
//   Otherwise defaults to a fresh database named "showcall_import".
// - You can override target with:
//     • CLI:   --target-db=<name> | --into-active | --into-import
//     • ENV:   DB_IMPORT_TARGET_DB=<name> | DB_IMPORT_MODE=active|import

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

function resolvePsql() {
  // Prefer Homebrew PostgreSQL 17
  const brewPrefix = spawnSync('brew', ['--prefix', 'postgresql@17'], { encoding: 'utf8' });
  if (brewPrefix.status === 0) {
    const prefix = brewPrefix.stdout.trim();
    const psqlPath = path.join(prefix, 'bin/psql');
    if (fs.existsSync(psqlPath)) return psqlPath;
  }
  // Fallback to PATH
  const which = spawnSync('which', ['psql'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.trim();
  return null;
}

function findLatestBackupFile(backupsDir) {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => ({
        name: f,
        fullPath: path.join(backupsDir, f),
        mtimeMs: fs.statSync(path.join(backupsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files[0]?.fullPath || null;
  } catch {
    return null;
  }
}

function withDbName(dbUrl, dbName) {
  const u = new URL(dbUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return result;
}

async function main() {
  const backupsDir = path.resolve(process.cwd(), 'data/postgres/backups');
  const latestBackup = findLatestBackupFile(backupsDir);
  if (!latestBackup) {
    console.error('No SQL backups found in data/postgres/backups. Create one with: pnpm run db:backup');
    process.exit(1);
  }

  const psql = resolvePsql();
  if (!psql) {
    console.error('psql not found. Please install PostgreSQL client tools (e.g., brew install postgresql@17).');
    process.exit(1);
  }

  const baseUrl = getDatabaseUrl();
  const maintenanceUrl = withDbName(baseUrl, 'postgres');
  // Determine target database
  const argv = process.argv.slice(2);
  const argTargetDb = (argv.find(a => a.startsWith('--target-db=')) || '').split('=')[1];
  const modeActive = argv.includes('--into-active') || process.env.DB_IMPORT_MODE === 'active';
  const modeImport = argv.includes('--into-import') || process.env.DB_IMPORT_MODE === 'import';
  const envTargetDb = process.env.DB_IMPORT_TARGET_DB;

  const urlDbName = (() => { try { return new URL(baseUrl).pathname.replace(/^\//, '') || null; } catch { return null; } })();
  let targetDb = argTargetDb || envTargetDb || null;
  if (!targetDb) {
    if (modeActive) {
      targetDb = urlDbName && urlDbName !== '' ? urlDbName : 'postgres';
    } else if (modeImport) {
      targetDb = 'showcall_import';
    } else {
      // Default: use the active DB from DATABASE_URL when it's not 'postgres'; else fall back to showcall_import
      targetDb = urlDbName && urlDbName !== '' && urlDbName !== 'postgres' ? urlDbName : 'showcall_import';
    }
  }

  const targetDbUrl = withDbName(baseUrl, targetDb);

  console.log(`📦 Importing latest backup into database "${targetDb}"`);
  console.log(`📄 Backup file: ${latestBackup}`);

  // If target is not 'postgres', do a clean drop/create of the target DB to avoid conflicts
  // If target is 'postgres', skip drop/create to avoid destroying the maintenance DB; import may fail if objects already exist
  if (targetDb !== 'postgres') {
    let result = run(psql, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', `--dbname=${maintenanceUrl}`, '-c', `DROP DATABASE IF EXISTS ${targetDb}`]);
    if (result.status !== 0) {
      console.error(result.stderr || `Failed to drop database ${targetDb}`);
      process.exit(result.status || 1);
    }

    // Create target DB
    result = run(psql, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', `--dbname=${maintenanceUrl}`, '-c', `CREATE DATABASE ${targetDb} WITH TEMPLATE=template0`]);
    if (result.status !== 0) {
      console.error(result.stderr || `Failed to create database ${targetDb}`);
      process.exit(result.status || 1);
    }
  } else {
    console.warn(`⚠️  Target database is "postgres". Skipping DROP/CREATE. If import fails due to existing objects, consider:\n  • Using --into-import (or DB_IMPORT_MODE=import) to import into a fresh database, or\n  • Dropping conflicting schemas/tables manually before import`);
  }

  // Import SQL file
  const result = run(psql, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', `--dbname=${targetDbUrl}`, '-f', latestBackup]);
  if (result.status !== 0) {
    // If version mismatch, hint
    if ((result.stderr || '').includes('psql: error') && (result.stderr || '').includes('version')) {
      console.error('Detected possible version mismatch. On macOS, install matching client: brew install postgresql@17');
    }
    console.error(result.stderr || 'Import failed');
    process.exit(result.status || 1);
  }

  console.log(`✅ Import completed into database: ${targetDb}`);
  console.log(`🔗 Connect using: ${targetDbUrl}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


