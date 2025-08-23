import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';
import { eq } from 'drizzle-orm';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schemaIdToValidator: Map<string, ValidateFunction> = new Map();

export async function validateItemAttributes(schemaId: string, attributes: any): Promise<{ ok: true } | { ok: false; message: string; path?: string }> {
  let validator = schemaIdToValidator.get(schemaId);
  if (!validator) {
    const db = await getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
    const row = (await db
      .select({ jsonSchema: schema.attributeSchema.jsonSchema })
      .from(schema.attributeSchema)
      .where(eq(schema.attributeSchema.schemaId, schemaId))
      .limit(1))[0];
    if (!row) return { ok: false, message: 'attribute schema not found' };
    validator = ajv.compile(row.jsonSchema as any);
    schemaIdToValidator.set(schemaId, validator);
  }
  const valid = validator(attributes);
  if (valid) return { ok: true };
  const firstError = (validator.errors || [])[0];
  const message = firstError?.message || 'invalid attributes';
  const path = firstError?.instancePath || firstError?.schemaPath;
  return { ok: false, message: String(message), path: path ? String(path) : undefined };
}


