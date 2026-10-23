import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DB, TableName, Tables } from '../types';
import { SCHEMA, emptyDB } from './schema';
import type { StorageService } from './storage';

type Op = { kind: 'upsert'; table: TableName; id: string } | { kind: 'remove'; items: { table: TableName; ids: string[] }[] };
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export interface Toast { id: number; text: string; tone: 'ok' | 'error' }

interface Ctx {
  db: DB;
  storage: StorageService;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string;
  warnings: string[];
  save: { state: SaveState; error: string; pending: number };
  retrySave: () => void;
  reload: () => Promise<void>;
  create: <T extends TableName>(table: T, recs: Tables[T] | Tables[T][], toast?: string) => void;
  update: <T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>, opts?: { debounce?: boolean; toast?: string }) => void;
  remove: (table: TableName, id: string, toast?: string) => void;
  setSetting: (key: string, value: string | number, debounce?: boolean) => void;
  toasts: Toast[];
  notify: (text: string, tone?: 'ok' | 'error') => void;
}

const DataContext = createContext<Ctx | null>(null);
const DEBOUNCE_MS = 700;

export function DataProvider({ storage, children }: { storage: StorageService; children: ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDB);
  const dbRef = useRef<DB>(db);
  const [loadState, setLoadState] = useState<Ctx['loadState']>('loading');
  const [loadError, setLoadError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [save, setSave] = useState<Ctx['save']>({ state: 'idle', error: '', pending: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef<Op[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastLoad = useRef(0);

  const commit = (next: DB) => { dbRef.current = next; setDb(next); };

  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2600);
  }, []);

  const refreshSave = useCallback((err?: string) => {
    const p = pending.current + timers.current.size;
    setSave((s) => ({
      pending: p,
      error: err ?? (failed.current.length ? s.error : ''),
      state: failed.current.length ? 'error' : p > 0 ? 'saving' : s.state === 'idle' ? 'idle' : 'saved',
    }));
  }, []);

  const run = useCallback((op: Op, toast?: string) => {
    pending.current++;
    refreshSave();
    queue.current = queue.current.then(async () => {
      try {
        if (op.kind === 'upsert') {
          const rec = (dbRef.current[op.table] as { id: string }[]).find((r) => r.id === op.id);
          if (rec) await storage.upsert(op.table, rec as never); // read latest at run time → coalesces fast edits
        } else {
          await storage.remove(op.items);
        }
        if (toast) notify(toast);
        pending.current--;
        setSave((s) => ({ ...s, state: 'saved' }));
        refreshSave();
      } catch (e) {
        pending.current--;
        failed.current.push(op);
        const msg = e instanceof Error ? e.message : 'Could not save.';
        notify(`Not saved: ${msg}`, 'error');
        refreshSave(msg);
      }
    });
  }, [storage, notify, refreshSave]);

  const schedule = useCallback((table: TableName, id: string, debounce: boolean, toast?: string) => {
    const key = `${table}:${id}`;
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    if (!debounce) { timers.current.delete(key); run({ kind: 'upsert', table, id }, toast); return; }
    timers.current.set(key, setTimeout(() => { timers.current.delete(key); run({ kind: 'upsert', table, id }, toast); }, DEBOUNCE_MS));
    refreshSave();
  }, [run, refreshSave]);

  const flushTimers = useCallback(() => {
    for (const [key, t] of timers.current) {
      clearTimeout(t);
      timers.current.delete(key);
      const [table, id] = key.split(':') as [TableName, string];
      run({ kind: 'upsert', table, id });
    }
  }, [run]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoadState('loading');
    try {
      const r = await storage.loadAll();
      commit(r.db);
      setWarnings(r.warnings);
      setLoadState('ready');
      setLoadError('');
      lastLoad.current = Date.now();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load your data.';
      if (silent) notify(`Couldn't refresh: ${msg}`, 'error');
      else { setLoadError(msg); setLoadState('error'); }
    }
  }, [storage, notify]);

  useEffect(() => { void load(); }, [load]);

  // Keep the UI in sync with edits made directly in the spreadsheet (on tab focus, if nothing is unsaved).
  useEffect(() => {
    if (storage.kind !== 'google') return;
    const onFocus = () => {
      if (document.visibilityState === 'hidden') { flushTimers(); return; }
      const busy = pending.current > 0 || timers.current.size > 0 || failed.current.length > 0;
      if (!busy && Date.now() - lastLoad.current > 30_000) void load(true);
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => { document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('focus', onFocus); };
  }, [storage.kind, load, flushTimers]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current + timers.current.size + failed.current.length > 0) { flushTimers(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [flushTimers]);

  const create: Ctx['create'] = useCallback((table, recs, toast) => {
    const list = (Array.isArray(recs) ? recs : [recs]) as { id: string }[];
    const cur = dbRef.current[table] as { id: string }[];
    const fresh = list.filter((r) => !cur.some((c) => c.id === r.id)); // no duplicate ids locally
    if (!fresh.length) return;
    commit({ ...dbRef.current, [table]: [...cur, ...fresh] } as DB);
    fresh.forEach((r, i) => run({ kind: 'upsert', table, id: r.id }, i === fresh.length - 1 ? toast : undefined));
  }, [run]);

  const update: Ctx['update'] = useCallback((table, id, patch, opts) => {
    const cur = dbRef.current[table] as { id: string }[];
    if (!cur.some((r) => r.id === id)) return;
    commit({ ...dbRef.current, [table]: cur.map((r) => (r.id === id ? { ...r, ...patch } : r)) } as DB);
    schedule(table, id, !!opts?.debounce, opts?.toast);
  }, [schedule]);

  const remove: Ctx['remove'] = useCallback((table, id, toast) => {
    // collect cascading children (e.g. skill → topics → subtopics)
    const byTable = new Map<TableName, Set<string>>();
    const add = (t: TableName, i: string) => {
      const set = byTable.get(t) ?? new Set<string>();
      if (set.has(i)) return;
      set.add(i); byTable.set(t, set);
      for (const c of SCHEMA[t].cascade ?? []) {
        (dbRef.current[c.table] as unknown as Record<string, string>[]).filter((r) => r[c.key] === i).forEach((r) => add(c.table, r.id));
      }
    };
    add(table, id);
    const next = { ...dbRef.current } as Record<TableName, { id: string }[]>;
    byTable.forEach((ids, t) => {
      next[t] = next[t].filter((r) => !ids.has(r.id));
      ids.forEach((i) => { const k = `${t}:${i}`; const tm = timers.current.get(k); if (tm) { clearTimeout(tm); timers.current.delete(k); } });
    });
    commit(next as DB);
    run({ kind: 'remove', items: [...byTable].map(([t, ids]) => ({ table: t, ids: [...ids] })) }, toast);
  }, [run]);

  const setSetting: Ctx['setSetting'] = useCallback((key, value, debounce = true) => {
    const v = String(value);
    if (dbRef.current.settings.some((s) => s.id === key)) update('settings', key, { value: v }, { debounce });
    else create('settings', { id: key, value: v });
  }, [create, update]);

  const retrySave = useCallback(() => {
    const ops = failed.current; failed.current = [];
    setSave((s) => ({ ...s, error: '' }));
    ops.forEach((op) => run(op));
  }, [run]);

  const value = useMemo<Ctx>(() => ({
    db, storage, loadState, loadError, warnings, save, retrySave, reload: () => load(), create, update, remove, setSetting, toasts, notify,
  }), [db, storage, loadState, loadError, warnings, save, retrySave, load, create, update, remove, setSetting, toasts, notify]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Ctx {
  const c = useContext(DataContext);
  if (!c) throw new Error('useData must be used inside DataProvider');
  return c;
}
