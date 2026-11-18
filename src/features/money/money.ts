import { useSyncExternalStore } from 'react';
import type { CatKind, Category, DB, Txn, Wallet, WalletKind } from '../../types';
import { dateStr, parseDate, today } from '../../lib/format';
import { parseAmount } from '../../lib/parse';
import { balances } from '../../lib/calc';

// ---------- Colours (white icon on a coloured circle, like the phone app — tuned for the light theme) ----------
export const MONEY_COLORS = ['#E5676B', '#E8B14A', '#7CC36A', '#4FB6D8', '#E46C9A', '#9DB4F0', '#5B8DEF', '#A08ADB', '#F08A5D', '#5FB59A', '#C58B6B', '#8A94A3'];

// ---------- Default categories (from the categories used in the phone app) ----------
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-|-$/g, '') || 'x';
export const catId = (kind: CatKind, name: string) => `cat_${kind}_${slug(name)}`;

const DEFAULT_OUT: [string, string, string][] = [
  ['Transport', 'car', '#E5676B'], ['Office meal', 'hamburger', '#E46C9A'], ['Electricity', 'zap', '#E8B14A'], ['Recharge', 'smartphone', '#9DB4F0'],
  ['Rent', 'house', '#E46C9A'], ['Fruits', 'apple', '#7CC36A'], ['Flower', 'flower', '#E46C9A'], ['Internet', 'wifi', '#7CC36A'],
  ['Bazaar', 'shopping-cart', '#E8B14A'], ['Doi', 'milk', '#E8B14A'], ['Medicine', 'pill', '#E8B14A'], ['Hospital test', 'stethoscope', '#E46C9A'],
  ['Baby', 'baby', '#5B8DEF'], ['Diaper', 'paw-print', '#E8B14A'], ['Saloon', 'scissors', '#E5676B'], ['Tailor', 'shirt', '#E8B14A'],
  ['Furniture', 'sofa', '#E46C9A'], ['Borrow paid', 'hand-coins', '#5B8DEF'], ['Pizza', 'pizza', '#E8B14A'], ['Cafe', 'utensils', '#E5676B'],
  ['Bike', 'motorbike', '#E5676B'], ['Shopping', 'shopping-bag', '#A08ADB'], ['Bills', 'receipt', '#4FB6D8'], ['Other', 'circle-question-mark', '#8A94A3'],
];
const DEFAULT_IN: [string, string, string][] = [
  ['Salary', 'circle-dollar-sign', '#E46C9A'], ['Bike oil', 'motorbike', '#E5676B'], ['Secret box', 'hand-coins', '#E5676B'], ['Bonus', 'circle-dollar-sign', '#E5676B'],
  ['Outsourcing', 'laptop', '#E5676B'], ['Gift', 'gift', '#E46C9A'], ['Other', 'circle-question-mark', '#7CC36A'],
];

/** Default categories plus one for every category name already used in old transactions. */
export function defaultCategories(txns: Txn[] = []): Category[] {
  const out: Category[] = [];
  const add = (kind: CatKind, name: string, icon: string, color: string) => {
    const id = catId(kind, name);
    if (!out.some((c) => c.id === id)) out.push({ id, name, kind, icon, color, order: out.filter((c) => c.kind === kind).length });
  };
  DEFAULT_OUT.forEach(([n, i, c]) => add('out', n, i, c));
  DEFAULT_IN.forEach(([n, i, c]) => add('in', n, i, c));
  txns.forEach((t, k) => { if ((t.kind === 'out' || t.kind === 'in') && t.category.trim()) add(t.kind, t.category.trim(), 'tag', MONEY_COLORS[k % MONEY_COLORS.length]); });
  return out;
}

export const WALLET_ICON: Record<WalletKind, string> = { Bank: 'landmark', 'Mobile wallet': 'smartphone', Cash: 'banknote', Card: 'credit-card', Savings: 'piggy-bank' };
export const walletIcon = (w: Wallet) => w.icon || WALLET_ICON[w.kind] || 'wallet';
export const walletColor = (w: Wallet, i = 0) => w.color || MONEY_COLORS[(i * 3) % MONEY_COLORS.length];

/** Balance of every account, and the total over accounts that are counted (not hidden). */
export function accountTotals(db: DB) {
  const bal = balances(db);
  const total = db.wallets.filter((w) => !w.hidden).reduce((a, w) => a + (bal.get(w.id) ?? 0), 0);
  return { bal, total };
}

// ---------- Resolve a transaction's category (old rows only have a name) ----------
export interface CatView { id: string; name: string; icon: string; color: string; kind: CatKind; missing?: boolean }
export function catResolver(db: DB) {
  const byId = new Map(db.categories.map((c) => [c.id, c]));
  const byName = new Map(db.categories.map((c) => [`${c.kind}:${c.name.trim().toLowerCase()}`, c]));
  return (t: Txn): CatView => {
    const kind: CatKind = t.kind === 'in' ? 'in' : 'out';
    const c = byId.get(t.categoryId) ?? byName.get(`${kind}:${(t.category || '').trim().toLowerCase()}`);
    if (c) return c;
    const name = t.category?.trim() || 'Uncategorised';
    return { id: `name:${kind}:${name.toLowerCase()}`, name, icon: 'tag', color: '#8A94A3', kind, missing: true };
  };
}

/** Categories of one kind, most used (last 90 days) first, then by their order. */
export function rankedCategories(db: DB, kind: CatKind): Category[] {
  const since = dateStr(new Date(Date.now() - 90 * 864e5));
  const use = new Map<string, number>();
  const resolve = catResolver(db);
  db.txns.forEach((t) => { if (t.kind === kind && t.date >= since) { const c = resolve(t); use.set(c.id, (use.get(c.id) ?? 0) + 1); } });
  return db.categories.filter((c) => c.kind === kind).sort((a, b) => (use.get(b.id) ?? 0) - (use.get(a.id) ?? 0) || a.order - b.order);
}

// ---------- Periods ----------
export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'range';
export const PERIODS: { value: PeriodType; label: string }[] = [
  { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'range', label: 'Period' },
];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS_LONG.map((m) => m.slice(0, 3));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface Range { from: string; to: string; label: string; isNow: boolean }
export function periodRange(type: PeriodType, anchor: string, from: string, to: string): Range {
  const a = parseDate(anchor) ?? new Date();
  const t = today();
  let f: Date, e: Date, label: string;
  switch (type) {
    case 'day':
      f = e = a; label = `${MONTHS_LONG[a.getMonth()]} ${a.getDate()} (${DOW[a.getDay()]})${a.getFullYear() !== new Date().getFullYear() ? `, ${a.getFullYear()}` : ''}`; break;
    case 'week':
      f = new Date(a.getFullYear(), a.getMonth(), a.getDate() - a.getDay()); e = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 6);
      label = `${MON[f.getMonth()]} ${f.getDate()} – ${MON[e.getMonth()]} ${e.getDate()}`; break;
    case 'month':
      f = new Date(a.getFullYear(), a.getMonth(), 1); e = new Date(a.getFullYear(), a.getMonth() + 1, 0); label = `${MONTHS_LONG[a.getMonth()]} ${a.getFullYear()}`; break;
    case 'year':
      f = new Date(a.getFullYear(), 0, 1); e = new Date(a.getFullYear(), 11, 31); label = String(a.getFullYear()); break;
    default: {
      const ff = parseDate(from) ?? new Date(a.getFullYear(), a.getMonth(), 1), ee = parseDate(to) ?? a;
      [f, e] = ff <= ee ? [ff, ee] : [ee, ff];
      label = `${f.getDate()} ${MON[f.getMonth()]} – ${e.getDate()} ${MON[e.getMonth()]} ${e.getFullYear()}`;
    }
  }
  const fs = dateStr(f), es = dateStr(e);
  return { from: fs, to: es, label, isNow: fs <= t && t <= es };
}
export function shiftAnchor(type: PeriodType, anchor: string, dir: number): string {
  const a = parseDate(anchor) ?? new Date();
  if (type === 'day') a.setDate(a.getDate() + dir);
  if (type === 'week') a.setDate(a.getDate() + 7 * dir);
  if (type === 'month') { a.setDate(1); a.setMonth(a.getMonth() + dir); }
  if (type === 'year') a.setFullYear(a.getFullYear() + dir);
  return dateStr(a);
}
export const longDate = (s: string) => {
  const d = parseDate(s);
  return d ? `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (${DOW[d.getDay()]})` : s;
};
export const shortMD = (s: string) => { const d = parseDate(s); return d ? `${d.getMonth() + 1}/${d.getDate()}` : ''; };

// ---------- Shared view state (kept while moving between money pages) ----------
export interface MoneyView { kind: CatKind; period: PeriodType; anchor: string; from: string; to: string; scope: string; lastDate: string }
let state: MoneyView = { kind: 'out', period: 'day', anchor: today(), from: '', to: '', scope: '', lastDate: '' };
const subs = new Set<() => void>();
export function setMoneyView(p: Partial<MoneyView>) { state = { ...state, ...p }; subs.forEach((f) => f()); }
export function useMoneyView(): MoneyView {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}
export const inRange = (t: Txn, r: Range) => t.date >= r.from && t.date <= r.to;
/** Does a transaction belong to the chosen account scope? ('' = all accounts) */
export const inScope = (t: Txn, scope: string) => !scope || t.walletId === scope || t.toWalletId === scope;

// ---------- Amount input: "1200", "2.5k", "120+45*2", "1,500 - 200" ----------
export function evalAmount(input: string): number {
  const s = String(input ?? '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s|,/g, '');
  if (!s) return 0;
  const toks = s.match(/[+\-*/]|[^+\-*/]+/g) ?? [];
  const nums: number[] = [], ops: string[] = [];
  const prec = (o: string) => (o === '*' || o === '/' ? 2 : 1);
  const apply = () => { const b = nums.pop()!, a = nums.pop()!, o = ops.pop()!; nums.push(o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : a / b); };
  let expectNum = true;
  for (const tk of toks) {
    if (/^[+\-*/]$/.test(tk)) {
      if (expectNum) { if (tk === '-' && !nums.length) { nums.push(0); } else return NaN; }
      while (ops.length && prec(ops.at(-1)!) >= prec(tk)) apply();
      ops.push(tk); expectNum = true;
    } else {
      const v = parseAmount(tk);
      if (!Number.isFinite(v)) return NaN;
      nums.push(v); expectNum = false;
    }
  }
  if (expectNum) return NaN;
  while (ops.length) apply();
  const r = nums[0];
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : NaN;
}

// ---------- CSV export ----------
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Group a list of transactions by date, newest first. */
export function byDate(list: Txn[]): [string, Txn[]][] {
  const m = new Map<string, Txn[]>();
  list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).forEach((t) => m.set(t.date, [...(m.get(t.date) ?? []), t]));
  return [...m];
}
