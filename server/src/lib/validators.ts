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


