import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export async function convertToBaseUnits(baseUnit: string, qty: number, unit: string): Promise<number> {
  if (unit === baseUnit) return qty;
  const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  // direct
  const direct = await db
    .select({ factor: schema.unitConversions.factor })
    .from(schema.unitConversions)
    .where(and(eq(schema.unitConversions.fromUnit, unit), eq(schema.unitConversions.toUnit, baseUnit)))
    .limit(1);
  if (direct[0]) return Number(qty) * Number(direct[0].factor);
  // inverse
  const inverse = await db
    .select({ factor: schema.unitConversions.factor })
    .from(schema.unitConversions)
    .where(and(eq(schema.unitConversions.fromUnit, baseUnit), eq(schema.unitConversions.toUnit, unit)))
    .limit(1);
  if (inverse[0]) return Number(qty) / Number(inverse[0].factor);
  throw new Error(`No conversion path from ${unit} to ${baseUnit}`);
}


