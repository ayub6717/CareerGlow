import type { DB, Goal, Reminder, Skill, Subtopic, Task, Topic, Txn } from '../types';
import { dateStr, dur, idx, nowIdx, parseDate, today } from './format';

// ---------- settings ----------
export const SETTING_DEFAULTS = { income: '0', inflation: '6', weeklyHours: '20', emMonths: '6', emSaved: '0', emMonthly: '0' } as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export const settingNum = (db: DB, key: SettingKey): number => {
  const v = db.settings.find((s) => s.id === key)?.value ?? SETTING_DEFAULTS[key];
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : parseFloat(SETTING_DEFAULTS[key]);
};

// ---------- monthly plan / finance ----------
export interface Fin { income: number; expense: number; saving: number; emTarget: number; emLeft: number; emMonthly: number; cap: number; emPct: number; emCoverM: number; emSaved: number }
export function finance(db: DB): Fin {
  const income = settingNum(db, 'income');
  const expense = db.plannedExpenses.reduce((a, x) => a + (x.amount || 0), 0);
  const saving = income - expense;
  const emSaved = settingNum(db, 'emSaved');
  const emTarget = expense * settingNum(db, 'emMonths');
  const emLeft = Math.max(0, emTarget - emSaved);
  const emMonthly = emLeft > 0 ? settingNum(db, 'emMonthly') : 0;
  return {
    income, expense, saving, emTarget, emLeft, emMonthly, emSaved, cap: Math.max(0, saving - emMonthly),
    emPct: emTarget > 0 ? Math.min(100, Math.round((emSaved / emTarget) * 100)) : 0,
    emCoverM: expense > 0 ? emSaved / expense : 0,
  };
}

// ---------- goals ----------
export type StatusKind = 'good' | 'done' | 'bad' | 'idle';
export interface GoalCalc {
  target: number; real: number; saved: number; monthly: number; remaining: number; monthsLeft: number; need: number;
  pace: number; finishI: number; late: number; dueI: number; startI: number;
  msDone: number; msTotal: number; msPct: number; moneyPct: number; pct: number;
  hoursEst: number; logged: number; weekly: number; hoursLeft: number; weeksLeft: number; timeFinishI: number; timePct: number;
  unmet: Goal[]; kind: StatusKind; status: string; next: string; behind: boolean;
}
export interface CalcOpts { monthly?: number; costX?: number; infAdd?: number }

export function goalCalc(db: DB, g: Goal, opt: CalcOpts = {}): GoalCalc {
  const now = nowIdx(), inf = settingNum(db, 'inflation') / 100;
  const items = db.goalItems.filter((i) => i.goalId === g.id);
  const target = items.reduce((a, it) => a + (it.amount || 0), 0) * (opt.costX ?? 1);
  const dueI = idx(g.due), startI = idx(g.start);
  const real = target * Math.pow(1 + inf + (opt.infAdd ?? 0), Math.max(0, (dueI - now) / 12));
  const saved = g.saved || 0;
  const monthly = opt.monthly ?? (g.monthly || 0);
  const remaining = Math.max(0, real - saved);
  const monthsLeft = Math.max(1, dueI - now);
  const pace = remaining <= 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : Infinity;
  const finishI = now + pace, late = Number.isFinite(pace) ? finishI - dueI : Infinity;
  const ms = db.milestones.filter((m) => m.goalId === g.id).sort((a, b) => a.order - b.order);
  const msDone = ms.filter((m) => m.done).length, msPct = ms.length ? Math.round((msDone / ms.length) * 100) : 0;
  const moneyPct = real > 0 ? Math.min(100, Math.round((saved / real) * 100)) : 0;
  const hoursEst = g.hoursEst || 0, weekly = g.weekly || 0;
  const logged = db.timeLog.filter((l) => l.goalId === g.id).reduce((a, l) => a + (l.hours || 0), 0);
  const hoursLeft = Math.max(0, hoursEst - logged);
  const weeksLeft = hoursLeft <= 0 ? 0 : weekly > 0 ? Math.ceil(hoursLeft / weekly) : Infinity;
  const timeFinishI = Number.isFinite(weeksLeft) ? now + Math.ceil(weeksLeft / 4.33) : Infinity;
  const timePct = hoursEst > 0 ? Math.min(100, Math.round((logged / hoursEst) * 100)) : 0;
  const parts: number[] = [];
  if (g.useBudget && target > 0) parts.push(moneyPct);
  if (ms.length) parts.push(msPct);
  if (g.useTime && hoursEst > 0) parts.push(timePct);
  const done = g.state === 'done';
  const pct = done ? 100 : parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
  const unmet = (g.deps || []).map((id) => db.goals.find((x) => x.id === id)).filter((x): x is Goal => !!x && x.state !== 'done');
  const elapsed = dueI > startI ? Math.min(1, Math.max(0, (now - startI) / (dueI - startI))) : 1;
  const timeLate = g.useTime && hoursEst > 0 ? (Number.isFinite(timeFinishI) ? timeFinishI - dueI : hoursLeft > 0 ? Infinity : -1) : -1;
  let kind: StatusKind = 'good', status = 'On track';
  if (done) { kind = 'done'; status = 'Done'; }
  else if (g.state === 'paused') { kind = 'idle'; status = 'Paused'; }
  else if (unmet.length) { kind = 'idle'; status = 'Waiting'; }
  else if (g.useBudget && target > 0 && remaining <= 0) { kind = 'done'; status = 'Funded'; }
  else if (g.useBudget && target > 0 && late > 0) { kind = 'bad'; status = Number.isFinite(late) ? `Behind ${dur(late)}` : 'Not funded'; }
  else if (timeLate > 0) { kind = 'bad'; status = Number.isFinite(timeLate) ? `Behind ${dur(timeLate)}` : 'No hours set'; }
  else if (!g.useBudget && !g.useTime && ms.length && msPct + 15 < elapsed * 100) { kind = 'bad'; status = 'Behind'; }
  const next = ms.find((m) => !m.done);
  return {
    target, real, saved, monthly, remaining, monthsLeft, need: g.useBudget && !done ? remaining / monthsLeft : 0, pace, finishI, late, dueI, startI,
    msDone, msTotal: ms.length, msPct, moneyPct, pct, hoursEst, logged, weekly, hoursLeft, weeksLeft, timeFinishI, timePct, unmet,
    kind, status, next: next ? next.text : ms.length ? 'All milestones done' : 'Add a first milestone', behind: kind === 'bad',
  };
}

export interface Alloc { g: Goal; c: GoalCalc; alloc: number; extra: number }
/** Smart split: nearest deadline first; leftover speeds up the earliest unfunded goal. */
export function allocate(db: DB, cap: number): Alloc[] {
  let left = cap;
  const rows: Alloc[] = db.goals.filter((g) => g.state === 'active' && g.useBudget)
    .map((g) => ({ g, c: goalCalc(db, g), alloc: 0, extra: 0 })).sort((a, b) => a.c.dueI - b.c.dueI);
  rows.forEach((r) => { r.alloc = Math.min(Math.ceil(r.c.need), Math.max(0, left)); left -= r.alloc; });
  rows.forEach((r) => { if (left <= 0) return; const add = Math.min(Math.max(0, r.c.remaining - r.alloc), left); r.extra = add; left -= add; });
  return rows;
}

// ---------- tasks ----------
export function taskState(db: DB, t: Task) {
  const dep = t.dependsOn ? db.tasks.find((x) => x.id === t.dependsOn) : undefined;
  const waiting = !!dep && dep.status !== 'done';
  return { dep, waiting, ready: !!dep && !waiting && t.status === 'todo', overdue: t.status !== 'done' && !!t.due && t.due < today() };
}
export function realityCheck(db: DB) {
  const lim = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return dateStr(d); })();
  const open = db.tasks.filter((t) => t.status !== 'done' && (!t.due || t.due <= lim));
  const need = Math.round(open.reduce((a, t) => a + (t.hours || 0), 0));
  const wh = settingNum(db, 'weeklyHours');
  const have = Math.round((wh * 30) / 7), daily = wh / 7;
  return { need, have, over: need > have, daysNeeded: daily > 0 ? Math.ceil(need / daily) : Infinity, overdue: open.filter((t) => t.due && t.due < today()).length, weekly: wh };
}

// ---------- wallets ----------
export function balances(db: DB): Map<string, number> {
  const b = new Map<string, number>();
  db.wallets.forEach((w) => b.set(w.id, w.opening || 0));
  db.txns.forEach((t) => {
    const a = t.amount || 0;
    if (t.kind === 'in' && b.has(t.walletId)) b.set(t.walletId, b.get(t.walletId)! + a);
    if ((t.kind === 'out' || t.kind === 'move') && b.has(t.walletId)) b.set(t.walletId, b.get(t.walletId)! - a);
    if (t.kind === 'move' && b.has(t.toWalletId)) b.set(t.toWalletId, b.get(t.toWalletId)! + a);
  });
  return b;
}
export function monthTotals(txns: Txn[], ym: string) {
  const mt = txns.filter((x) => String(x.date).slice(0, 7) === ym);
  return {
    mt,
    inn: mt.filter((x) => x.kind === 'in').reduce((a, x) => a + (x.amount || 0), 0),
    out: mt.filter((x) => x.kind === 'out').reduce((a, x) => a + (x.amount || 0), 0),
  };
}

// ---------- reminders ----------
function step(d: Date, rep: 'monthly' | 'yearly', k: number): Date {
  const x = new Date(d.getTime());
  x.setDate(1);
  if (rep === 'monthly') x.setMonth(d.getMonth() + k); else x.setFullYear(d.getFullYear() + k);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
}
/** Next occurrence. Repeating reminders advance past `lastDone`; a missed one stays overdue for up to 7 days. */
export function nextDue(r: Reminder): { d: Date; k: number } | null {
  const base = parseDate(r.date);
  if (!base) return null;
  if (r.repeat === 'none') return { d: base, k: 0 };
  const t = parseDate(today())!;
  let floor = r.lastDone ? new Date(parseDate(r.lastDone)!.getTime() + 864e5) : new Date(t.getTime() - 7 * 864e5);
  if (floor < base) floor = base;
  let k = r.repeat === 'yearly'
    ? Math.max(0, floor.getFullYear() - base.getFullYear() - 1)
    : Math.max(0, (floor.getFullYear() - base.getFullYear()) * 12 + floor.getMonth() - base.getMonth() - 1);
  let d = step(base, r.repeat, k);
  for (let g = 0; d < floor && g < 2000; g++) { k++; d = step(base, r.repeat, k); }
  return { d, k };
}
export type RemGroup = 'overdue' | 'soon' | 'later' | 'done';
export function reminderInfo(r: Reminder) {
  const nx = r.done ? null : nextDue(r);
  const days = nx ? Math.round((nx.d.getTime() - parseDate(today())!.getTime()) / 864e5) : null;
  let group: RemGroup = 'later', when = '', tone: Tone = 'gray';
  if (r.done) { group = 'done'; when = 'Done'; tone = 'mint'; }
  else if (!nx || days == null) { when = 'Set a date'; tone = 'amber'; }
  else if (days < 0) { group = 'overdue'; when = `${-days} ${days === -1 ? 'day' : 'days'} late`; tone = 'rose'; }
  else if (days === 0) { group = 'soon'; when = 'Today'; tone = 'amber'; }
  else if (days <= Math.max(r.leadDays || 0, 7)) { group = 'soon'; when = days === 1 ? 'Tomorrow' : `In ${days} days`; tone = 'amber'; }
  else { when = `In ${days} days`; tone = 'blue'; }
  return { nx, days, group, when, tone };
}

// ---------- skills ----------
export type Tone = 'blue' | 'mint' | 'amber' | 'rose' | 'lav' | 'gray' | 'teal';
export type LearnState = 'not' | 'prog' | 'done';
export const LEARN_LABEL: Record<LearnState, string> = { not: 'Not Started', prog: 'In Progress', done: 'Completed' };
export const LEARN_TONE: Record<LearnState, Tone> = { not: 'gray', prog: 'blue', done: 'mint' };

/** A topic with subtopics counts each subtopic; a topic without subtopics counts as one item. */
export function topicProgress(t: Topic, subs: Subtopic[]) {
  const mine = subs.filter((s) => s.topicId === t.id);
  const total = mine.length || 1;
  const done = mine.length ? mine.filter((s) => s.done).length : t.done ? 1 : 0;
  const state: LearnState = done === 0 ? 'not' : done >= total ? 'done' : 'prog';
  return { total, done, pct: Math.round((done / total) * 100), state, count: mine.length };
}
export function skillProgress(db: DB, s: Skill) {
  const topics = db.topics.filter((t) => t.skillId === s.id);
  let total = 0, done = 0, topicsDone = 0;
  topics.forEach((t) => { const p = topicProgress(t, db.subtopics); total += p.total; done += p.done; if (p.state === 'done') topicsDone++; });
  const state: LearnState = done === 0 ? 'not' : done >= total ? 'done' : 'prog';
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, topicsDone, topicsTotal: topics.length, state };
}
