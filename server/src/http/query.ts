export function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v);
  return s.length === 0 ? undefined : s;
}

export function asNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function asBoolean(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return undefined;
}

export function asStringArray(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x));
  const s = String(v).trim();
  if (!s) return undefined;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export function ilikePattern(q?: string): string | undefined {
  if (!q) return undefined;
  return `%${q}%`;
}


