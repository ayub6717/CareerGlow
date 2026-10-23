import type { DB, TableName, Tables } from '../types';

export type FieldType = 'string' | 'number' | 'boolean' | 'ids';
type FieldMap<T> = { [K in keyof T]: FieldType };

export interface TableDef<T> {
  /** Worksheet (tab) title in the spreadsheet */
  sheet: string;
  /** Column order = header row. `id` is always column A. */
  fields: FieldMap<T>;
  /** Child tables removed together with a row of this table (foreign key → this id) */
  cascade?: { table: TableName; key: string }[];
}

type Schema = { [K in TableName]: TableDef<Tables[K]> };

export const SCHEMA: Schema = {
  settings: { sheet: 'Settings', fields: { id: 'string', value: 'string' } },
  plannedExpenses: { sheet: 'Planned Expenses', fields: { id: 'string', label: 'string', amount: 'number', order: 'number' } },
  goals: {
    sheet: 'Goals',
    fields: {
      id: 'string', name: 'string', area: 'string', state: 'string', start: 'string', due: 'string',
      focus: 'boolean', useBudget: 'boolean', useTime: 'boolean', saved: 'number', monthly: 'number', running: 'number',
      hoursEst: 'number', weekly: 'number', deps: 'ids', why: 'string', risk: 'string', resources: 'string', createdAt: 'string',
    },
    cascade: [
      { table: 'goalItems', key: 'goalId' },
      { table: 'milestones', key: 'goalId' },
      { table: 'deposits', key: 'goalId' },
      { table: 'timeLog', key: 'goalId' },
    ],
  },
  goalItems: { sheet: 'Goal Budget Lines', fields: { id: 'string', goalId: 'string', label: 'string', amount: 'number', order: 'number' } },
  milestones: { sheet: 'Milestones', fields: { id: 'string', goalId: 'string', text: 'string', done: 'boolean', order: 'number' } },
  deposits: { sheet: 'Goal Deposits', fields: { id: 'string', goalId: 'string', date: 'string', amount: 'number' } },
  timeLog: { sheet: 'Time Log', fields: { id: 'string', goalId: 'string', date: 'string', hours: 'number' } },
  tasks: {
    sheet: 'Tasks',
    fields: {
      id: 'string', title: 'string', goalId: 'string', status: 'string', priority: 'string', due: 'string',
      hours: 'number', dependsOn: 'string', blocked: 'boolean', doneAt: 'string', createdAt: 'string',
    },
  },
  wallets: { sheet: 'Wallets', fields: { id: 'string', name: 'string', kind: 'string', opening: 'number', order: 'number' } },
  txns: {
    sheet: 'Transactions',
    fields: {
      id: 'string', date: 'string', desc: 'string', amount: 'number', kind: 'string', category: 'string',
      walletId: 'string', toWalletId: 'string', createdAt: 'string',
    },
  },
  budgets: { sheet: 'Budgets', fields: { id: 'string', name: 'string', order: 'number' }, cascade: [{ table: 'budgetLines', key: 'budgetId' }] },
  budgetLines: { sheet: 'Budget Lines', fields: { id: 'string', budgetId: 'string', label: 'string', amount: 'string', order: 'number' } },
  reminders: {
    sheet: 'Reminders',
    fields: {
      id: 'string', title: 'string', date: 'string', kind: 'string', repeat: 'string', amount: 'number',
      walletId: 'string', leadDays: 'number', lastDone: 'string', done: 'boolean',
    },
  },
  jobs: {
    sheet: 'Job Applications',
    fields: {
      id: 'string', company: 'string', title: 'string', url: 'string', appliedDate: 'string', status: 'string',
      notes: 'string', createdAt: 'string', updatedAt: 'string',
    },
  },
  skills: {
    sheet: 'Skills',
    fields: { id: 'string', name: 'string', why: 'string', project: 'string', order: 'number', createdAt: 'string' },
    cascade: [
      { table: 'topics', key: 'skillId' },
      { table: 'subtopics', key: 'skillId' },
    ],
  },
  topics: {
    sheet: 'Topics',
    fields: { id: 'string', skillId: 'string', name: 'string', done: 'boolean', order: 'number' },
    cascade: [{ table: 'subtopics', key: 'topicId' }],
  },
  subtopics: {
    sheet: 'Subtopics',
    fields: { id: 'string', topicId: 'string', skillId: 'string', name: 'string', done: 'boolean', order: 'number' },
  },
  content: { sheet: 'Content', fields: { id: 'string', title: 'string', platform: 'string', stage: 'string', date: 'string', views: 'number' } },
  decisions: {
    sheet: 'Decisions',
    fields: { id: 'string', date: 'string', title: 'string', why: 'string', expect: 'string', reviewDate: 'string', outcome: 'string' },
  },
  counters: { sheet: 'Practice Counters', fields: { id: 'string', label: 'string', value: 'number', target: 'number' } },
};

export const TABLES = Object.keys(SCHEMA) as TableName[];

export function headers(t: TableName): string[] {
  return Object.keys(SCHEMA[t].fields);
}

export function emptyDB(): DB {
  const db = {} as Record<TableName, unknown[]>;
  TABLES.forEach((t) => (db[t] = []));
  return db as DB;
}

/** Record → sheet row. RAW input is used, so text starting with "=" is stored as text, never a formula. */
export function toRow<T extends TableName>(t: T, rec: Tables[T]): (string | number | boolean)[] {
  const f = SCHEMA[t].fields as Record<string, FieldType>;
  const r = rec as unknown as Record<string, unknown>;
  return Object.keys(f).map((k) => {
    const v = r[k];
    switch (f[k]) {
      case 'number': return Number.isFinite(Number(v)) ? Number(v) : 0;
      case 'boolean': return Boolean(v);
      case 'ids': return Array.isArray(v) ? v.join(',') : '';
      default: return v == null ? '' : String(v);
    }
  });
}

/** Sheet row → record, mapped by header names (columns can be reordered in the sheet safely). */
export function fromRow<T extends TableName>(t: T, head: string[], row: unknown[]): Tables[T] | null {
  const f = SCHEMA[t].fields as Record<string, FieldType>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(f)) {
    const i = head.indexOf(k);
    const raw = i >= 0 ? row[i] : undefined;
    switch (f[k]) {
      case 'number': {
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
        out[k] = Number.isFinite(n) ? n : 0;
        break;
      }
      case 'boolean':
        out[k] = raw === true || String(raw).toUpperCase() === 'TRUE';
        break;
      case 'ids':
        out[k] = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      default:
        out[k] = raw == null ? '' : String(raw);
    }
  }
  if (!out.id) return null;
  return out as unknown as Tables[T];
}
