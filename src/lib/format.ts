const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);

export const dateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = (): string => dateStr(new Date());
export const addDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return dateStr(d); };
export const nowIso = (): string => new Date().toISOString();

/** Month index = year*12 + month0 */
export const nowIdx = (): number => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };
export const idx = (ym: string): number => {
  const [y, m] = String(ym || '').split('-').map(Number);
  return y && m ? y * 12 + (m - 1) : nowIdx();
};
export const ymOf = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const monthLabel = (i: number): string => `${MONTHS[((i % 12) + 12) % 12]} ${Math.floor(i / 12)}`;
export const monthShort = (i: number): string => MONTHS[((i % 12) + 12) % 12];

export const parseDate = (s: string): Date | null => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
export const niceDate = (s: string, withYear = false): string => {
  const d = parseDate(s);
  if (!d) return 'No date';
  return d.toLocaleDateString('en-GB', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
};
export const daysSince = (s: string): number | null => {
  const d = parseDate(s);
  if (!d) return null;
  const t = parseDate(today())!;
  return Math.round((t.getTime() - d.getTime()) / 864e5);
};

export const tk = (n: number): string => {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '−' : ''}৳${Math.abs(v).toLocaleString('en-IN')}`;
};
/** Short taka: ৳2.5 L, ৳1.2 Cr */
export const tkS = (n: number): string => {
  const v = Number(n) || 0, a = Math.abs(v), sg = v < 0 ? '−' : '';
  if (a >= 1e7) return `${sg}৳${(a / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (a >= 1e5) return `${sg}৳${(a / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
  return tk(v);
};
export const dur = (m: number): string => {
  if (!Number.isFinite(m)) return 'never';
  const r = Math.round(m), y = Math.floor(r / 12), mo = r % 12, p: string[] = [];
  if (y) p.push(`${y} ${y > 1 ? 'yrs' : 'yr'}`);
  if (mo || !y) p.push(`${mo} mo`);
  return p.join(' ');
};
export const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;
