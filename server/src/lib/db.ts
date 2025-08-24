import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as createDrizzlePostgres } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from '../schema';

export type DatabaseConnection = ReturnType<typeof drizzle> | ReturnType<typeof createDrizzlePostgres>;

let cachedConnection: DatabaseConnection | null = null;
let cachedConnectionString: string | null = null;

const isNeonDatabase = (connectionString: string): boolean => {
  return connectionString.includes('neon.tech') || connectionString.includes('neon.database');
};

const createConnection = async (connectionString: string): Promise<DatabaseConnection> => {
  if (isNeonDatabase(connectionString)) {
    const sql = neon(connectionString);
    return drizzle(sql, { schema });
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return createDrizzlePostgres(client, { schema });
};

export const getDatabase = async (connectionString?: string): Promise<DatabaseConnection> => {
  // Use default local database connection if no external connection string provided
  // Note: In development, the port is dynamically allocated by port-manager.js
  const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
  const connStr = connectionString || defaultLocalConnection;

  if (cachedConnection && cachedConnectionString === connStr) {
    return cachedConnection;
  }

  if (!connStr) {
    throw new Error('No database connection available. Ensure database server is running or provide a connection string.');
  }

  cachedConnection = await createConnection(connStr);
  cachedConnectionString = connStr;

  return cachedConnection;
};

export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    if (!cachedConnection) return false;
    await cachedConnection.select().from(schema.users).limit(1);
    return true;
  } catch {
    return false;
  }
};

export const clearConnectionCache = (): void => {
  cachedConnection = null;
  cachedConnectionString = null;
};

// withTransaction helper for postgres-js connections.
// For neon-http (serverless) there is no transactional client in this setup, so we run the callback directly.
export async function withTransaction<T>(fn: (db: DatabaseConnection) => Promise<T>, connectionString?: string): Promise<T> {
  const db = await getDatabase(connectionString);
  // Detect whether this is the postgres-js drizzle client by the presence of a .transaction method on the underlying client
  const hasTx = typeof (db as any).transaction === 'function';
  if (hasTx) {
    return (db as any).transaction(async (tx: any) => fn(tx as DatabaseConnection));
  }
  // Fallback: best effort for neon-http: just execute without wrapping
  return fn(db);
}