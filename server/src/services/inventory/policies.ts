import { and, eq } from 'drizzle-orm';
import { DatabaseConnection, getDatabase } from '../../lib/db';
import { getDatabaseUrl } from '../../lib/env';
import * as schema from '../../schema';

export type DepartmentPolicy = Record<string, any>;

export async function loadPolicies(departmentId: string, itemType: string, dbOrTx?: DatabaseConnection): Promise<DepartmentPolicy> {
  const db = dbOrTx || (await getDatabase());
  const rows = await db
    .select({ key: schema.policies.key, value: schema.policies.value })
    .from(schema.policies)
    .where(and(eq(schema.policies.departmentId, departmentId), eq(schema.policies.itemType, itemType)));
  const out: DepartmentPolicy = {};
  for (const r of rows as any[]) out[r.key] = r.value;
  return out;
}

export function enforcePostingPolicies(params: {
  policies: DepartmentPolicy;
  eventType: string;
  itemType: string;
  onHandQtyBase?: number;
  reservationPresent?: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { policies, eventType } = params;
  // Allowed events
  const allowed: string[] | undefined = Array.isArray(policies.allowed_events) ? policies.allowed_events : undefined;
  if (allowed && !allowed.includes(eventType)) return { ok: false, message: 'Event type not allowed by policy' };

  // Reservation requirement
  if ((eventType === 'MOVE_OUT' || eventType === 'TRANSFER_OUT') && policies.require_reservation === true) {
    if (!params.reservationPresent) return { ok: false, message: 'Reservation required by policy' };
  }

  // Par/threshold checks (warning-level -> treat as block if hard_enforce)
  if (typeof policies.min_on_hand === 'number' && typeof params.onHandQtyBase === 'number') {
    const min = Number(policies.min_on_hand);
    if (params.onHandQtyBase < min && policies.enforce_min_on_hand === true) {
      return { ok: false, message: 'Below minimum on-hand per policy' };
    }
  }
  return { ok: true };
}


