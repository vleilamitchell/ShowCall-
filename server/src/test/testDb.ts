import postgres from 'postgres';
import { execSync } from 'node:child_process';
import path from 'node:path';

const serverDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

export async function resetTestDatabase(connectionString: string) {
  // Ensure app schema exists and apply migrations freshly
  process.env.DATABASE_URL = connectionString;
  const setupPath = path.join(serverDir, 'scripts', 'setup-private-schema.mjs');
  const applyPath = path.join(serverDir, 'scripts', 'apply-sql-migrations.mjs');
  // Serialize migrations to prevent deadlocks across test files
  const mutex = path.join(serverDir, '.test-migrate-lock');
  try {
    execSync(`bash -lc 'while [ -f ${mutex} ]; do sleep 0.05; done; trap "rm -f ${mutex}" EXIT; touch ${mutex}; ${process.execPath} ${setupPath} | cat; ${process.execPath} ${applyPath} | cat'`, { cwd: serverDir, stdio: 'inherit' });
  } catch (e) {
    throw e;
  } finally {
    try { execSync(`rm -f ${mutex}`); } catch {}
  }
}

export async function truncateAllTables(connectionString: string) {
  const sql = postgres(connectionString, { prepare: false, max: 1 });
  try {
    // Global advisory lock to avoid deadlocks when tests run in parallel
    await sql`SELECT pg_advisory_lock(913215);`;
    try {
      // Compute list of tables and truncate deterministically to reduce lock contention
      const rows = await sql<{ schemaname: string; tablename: string }[]>`
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('app','public')
          AND tablename NOT IN ('drizzle_migrations','drizzle_migrations_lock')
        ORDER BY schemaname, tablename
      `;

      if (rows.length > 0) {
        const identifiers = rows.map((r) => `${r.schemaname}.${r.tablename}`);
        const joined = identifiers.map((q) => `"${q.split('.')[0]}"."${q.split('.')[1]}"`).join(', ');
        await sql.unsafe(`TRUNCATE TABLE ${joined} RESTART IDENTITY CASCADE;`);
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(913215);`;
    }
  } finally {
    await sql.end();
  }
}


