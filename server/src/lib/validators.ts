export function isValidEmail(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
}

export function onlyDigits(v?: unknown): string { return String(v ?? '').replace(/\D/g, ''); }

export function isValidState(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  return /^[A-Z]{2}$/.test(String(v).toUpperCase());
}

export function isValidZip5(v?: unknown): boolean { const d = onlyDigits(v); return d.length === 0 || d.length === 5; }
export function isValidZip4(v?: unknown): boolean { const d = onlyDigits(v); return d.length === 0 || d.length === 4; }
export function isValidPhone(v?: unknown): boolean { const d = onlyDigits(v); return d.length === 0 || d.length >= 7; }

export function normalizeState(s?: string | null): string | null { return s ? String(s).slice(0,2).toUpperCase() : null; }
export function normalizeZip5(s?: string | null): string | null { return s ? String(s).replace(/\D/g, '').slice(0,5) : null; }
export function normalizeZip4(s?: string | null): string | null { return s ? String(s).replace(/\D/g, '').slice(0,4) : null; }
export function normalizePhone(s?: string | null): string | null { return s ? String(s).replace(/\D/g, '') : null; }

// Scheduling validators
export function isValidDateStr(s?: unknown): boolean {
  if (typeof s !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isValidTimeStr(s?: unknown): boolean {
  if (typeof s !== 'string') return false;
  return /^\d{2}:\d{2}$/.test(s);
}

// Inventory validators
export function isValidUnit(s?: unknown): boolean {
  if (s == null) return false;
  const v = String(s).trim();
  return v.length > 0 && v.length <= 32; // basic sanity; specific units validated against DB where needed
}

export function isValidEventType(s?: unknown): boolean {
  if (typeof s !== 'string') return false;
  const allowed = [
    'RECEIPT','TRANSFER_OUT','TRANSFER_IN','CONSUMPTION','WASTE','COUNT_ADJUST','RESERVATION_HOLD','RESERVATION_RELEASE','MOVE_OUT','MOVE_IN','MAINTENANCE_START','MAINTENANCE_END'
  ];
  return allowed.includes(s);
}

// URL validators
export function isValidUrl(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}


// Areas validators
export function isValidColor(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  const s = String(v).trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
}

export function validateAreaName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const s = name.trim();
  return s.length > 0 && s.length <= 120;
}


// Recurrence validators
export function isValidWeekdayMask(n?: unknown): boolean {
  if (n == null || String(n).trim() === '') return true;
  const v = typeof n === 'number' ? n : Number(String(n));
  if (!Number.isFinite(v)) return false;
  if (!Number.isInteger(v)) return false;
  return v >= 0 && v <= 127; // 7 bits for Sun..Sat
}

export function isValidFrequency(s?: unknown): boolean {
  if (s == null || String(s).trim() === '') return false;
  const v = String(s).trim().toUpperCase();
  return v === 'WEEKLY';
}

// Geo validators (optional for legacy address handlers)
export function isValidLatitude(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLongitude(v?: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}


