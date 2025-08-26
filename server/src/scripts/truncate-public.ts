import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDatabase, withTransaction } from '../lib/db';

async function main() {
  await withTransaction(async (db) => {
    const res: any = await (db as any).execute(sql`select table_schema, table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    const rows: Array<{ table_schema: string; table_name: string }> = res.rows ?? res;
    const fullyQualified = rows.map((r) => `"${r.table_schema}"."${r.table_name}"`);
    if (fullyQualified.length === 0) {
      console.log('No public tables to truncate.');
      return;
    }
    const stmt = sql.raw(`TRUNCATE TABLE ${fullyQualified.join(', ')} RESTART IDENTITY CASCADE`);
    await (db as any).execute(stmt);
    console.log('Truncated tables:', fullyQualified.length);
  });
}

main().catch((err) => {
  console.error('Truncate failed:', err);
  process.exit(1);
});
