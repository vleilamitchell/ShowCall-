export function formatTimeTo12Hour(time24: string | null | undefined): string {
  if (!time24) return '';
  const parts = String(time24).split(':');
  if (parts.length < 2) return String(time24);
  const hours24 = Number(parts[0]);
  const minutes = parts[1]?.slice(0, 2) ?? '00';
  if (Number.isNaN(hours24)) return String(time24);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes} ${period}`;
}

export function to12h(time24: string | null | undefined): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const value = time24 || '00:00';
  const parts = value.split(':');
  const h24 = Math.max(0, Math.min(23, Number(parts[0] ?? 0)));
  const m = Math.max(0, Math.min(59, Number(parts[1] ?? 0)));
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour: h12, minute: m, period };
}

export function to24h(t: { hour: number; minute: number; period: 'AM' | 'PM' }): string {
  let h = t.hour % 12;
  if (t.period === 'PM') h += 12;
  const hh = String(h).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, t.minute))).padStart(2, '0');
  return `${hh}:${mm}`;
}


