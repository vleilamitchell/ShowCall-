import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';

export async function refreshOnHandMaterializedView() {
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  // Drizzle-ORM allows raw SQL via db.execute
  await (db as any).execute(`REFRESH MATERIALIZED VIEW CONCURRENTLY on_hand`);
}


