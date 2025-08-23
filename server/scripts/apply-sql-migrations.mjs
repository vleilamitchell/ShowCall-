#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const migrationsDir = path.join(cwd, 'drizzle');

  // Prefer DATABASE_URL from env; fallback to typical local default
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/postgres';

  console.log('📦 Applying SQL migrations');
  console.log('📁 Migrations dir:', migrationsDir);
  console.log('🔌 Database:', connectionString.replace(/:(?:[^:@\/]+)@/, ':***@'));

  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️  No .sql migrations found. Nothing to do.');
    return;
  }

  const sql = postgres(connectionString, { prepare: false, max: 1 });
  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const contents = await fs.readFile(fullPath, 'utf-8');
      const trimmed = contents.trim();
      if (!trimmed) {
        console.log(`   ↪︎ Skipping empty file ${file}`);
        continue;
      }
      console.log(`➡️  Running ${file}...`);
      await sql.unsafe(trimmed);
      console.log(`   ✅ Applied ${file}`);
    }
    console.log('✅ All SQL migrations applied successfully');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err?.message || err);
  process.exit(1);
});


