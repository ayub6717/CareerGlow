import type { DB, TableName, Tables } from '../types';
import { SCHEMA, TABLES, emptyDB, fromRow, headers, toRow } from './schema';
import type { GoogleAuth } from './googleAuth';
import { getPasscode } from '../config';

export interface LoadResult { db: DB; warnings: string[] }

/** Everything the UI needs from a storage backend. All writes are whole-record and idempotent. */
export interface StorageService {
  readonly kind: 'google' | 'demo';
  readonly label: string;
  loadAll(): Promise<LoadResult>;
  /** Insert, or update if a row with this id already exists (prevents duplicates on retries). */
  upsert<T extends TableName>(table: T, rec: Tables[T]): Promise<void>;
  /** Delete rows by id across one or more tables in a single request. */
  remove(items: { table: TableName; ids: string[] }[]): Promise<void>;
  openUrl?: string;
}

// ---------------------------------------------------------------------------
// Demo storage — clearly labelled in the UI, keeps data in memory only.
// It exists so the interface can be tried before Google is configured. Nothing is saved.
// ---------------------------------------------------------------------------
export class DemoStorage implements StorageService {
  readonly kind = 'demo' as const;
  readonly label = 'Demo mode — nothing is saved';
  private seed: DB;
  constructor(seed: DB) { this.seed = seed; }
  async loadAll(): Promise<LoadResult> { return { db: structuredClone(this.seed), warnings: [] }; }
  async upsert(): Promise<void> { /* in-memory only */ }
  async remove(): Promise<void> { /* in-memory only */ }
}

// ---------------------------------------------------------------------------
// Google Sheets storage — Sheets API v4 over fetch. Authorised either with the user's OAuth token, or
// (auth = null) through the local /api/sheets proxy, which signs requests with a service-account key.
// ---------------------------------------------------------------------------
const GOOGLE_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const PROXY_API = '/api/sheets';
const base = (auth: GoogleAuth | null) => (auth ? GOOGLE_API : PROXY_API);

export class SheetsError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

const q = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;
function colLetter(n: number): string { // 1 → A
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function parseSpreadsheetId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

async function call<T>(auth: GoogleAuth | null, url: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const authz: Record<string, string> = auth ? { Authorization: `Bearer ${await auth.getToken()}` } : { 'X-App-Passcode': getPasscode() };
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), ...authz, 'Content-Type': 'application/json' } });
  } catch {
    if (attempt < 2) { await sleep(800 * (attempt + 1)); return call<T>(auth, url, init, attempt + 1); }
    throw new SheetsError('Network error — check your internet connection.', 0);
  }
  if (res.status === 401 && attempt === 0 && auth) { auth.invalidate(); return call<T>(auth, url, init, 1); }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) { await sleep(1000 * 2 ** attempt); return call<T>(auth, url, init, attempt + 1); }
  if (!res.ok) {
    let msg = `Google Sheets error ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch { /* ignore */ }
    if (res.status === 403) msg = auth ? `No permission to use this spreadsheet. (${msg})` : `No permission to use this spreadsheet — share it (Editor) with the service account's email. (${msg})`;
    if (res.status === 404) msg = auth ? 'Spreadsheet not found. Check the link or ID.' : 'Spreadsheet not found — or the /api/sheets proxy isn’t running on this host.';
    if (res.status === 401 && !auth) msg = 'Wrong passcode.';
    throw new SheetsError(msg, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

interface SheetMeta { properties: { title: string }; sheets: { properties: { sheetId: number; title: string } }[] }
interface BatchGet { valueRanges: { range: string; values?: unknown[][] }[] }

export class GoogleSheetsStorage implements StorageService {
  readonly kind = 'google' as const;
  label = 'Google Sheets';
  readonly id: string;
  private auth: GoogleAuth | null;
  private api: string;
  private sheetIds = new Map<string, number>();
  private heads = new Map<TableName, string[]>();

  constructor(auth: GoogleAuth | null, spreadsheetId: string) {
    this.auth = auth;
    this.api = base(auth);
    this.id = spreadsheetId;
  }

  get openUrl(): string { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }

  /** Create a fresh spreadsheet with every worksheet and header row. Returns its id. */
  static async create(auth: GoogleAuth, title: string): Promise<string> {
    const body = {
      properties: { title },
      sheets: TABLES.map((t) => ({ properties: { title: SCHEMA[t].sheet, gridProperties: { frozenRowCount: 1 } } })),
    };
    const r = await call<{ spreadsheetId: string }>(auth, base(auth), { method: 'POST', body: JSON.stringify(body) });
    const s = new GoogleSheetsStorage(auth, r.spreadsheetId);
    await s.ensureSchema();
    return r.spreadsheetId;
  }

  /** Adds any missing worksheets and header columns. Never deletes or reorders the user's data. */
  async ensureSchema(): Promise<void> {
    const meta = await call<SheetMeta>(this.auth, `${this.api}/${this.id}?fields=properties.title,sheets.properties(sheetId,title)`);
    this.label = meta.properties.title;
    meta.sheets.forEach((s) => this.sheetIds.set(s.properties.title, s.properties.sheetId));
    const missing = TABLES.filter((t) => !this.sheetIds.has(SCHEMA[t].sheet));
    if (missing.length) {
      const r = await call<{ replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }>(this.auth, `${this.api}/${this.id}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests: missing.map((t) => ({ addSheet: { properties: { title: SCHEMA[t].sheet, gridProperties: { frozenRowCount: 1 } } } })) }),
      });
      r.replies.forEach((x) => this.sheetIds.set(x.addSheet.properties.title, x.addSheet.properties.sheetId));
    }
    const ranges = TABLES.map((t) => `ranges=${encodeURIComponent(`${q(SCHEMA[t].sheet)}!1:1`)}`).join('&');
    const got = await call<BatchGet>(this.auth, `${this.api}/${this.id}/values:batchGet?${ranges}`);
    const fixes: { range: string; values: string[][] }[] = [];
    TABLES.forEach((t, i) => {
      const cur = (got.valueRanges[i]?.values?.[0] ?? []).map((x) => String(x).trim());
      const want = headers(t);
      const add = want.filter((h) => !cur.includes(h));
      const head = cur.length ? [...cur, ...add] : want;
      this.heads.set(t, head);
      if (!cur.length) fixes.push({ range: `${q(SCHEMA[t].sheet)}!A1`, values: [want] });
      else if (add.length) fixes.push({ range: `${q(SCHEMA[t].sheet)}!${colLetter(cur.length + 1)}1`, values: [add] });
    });
    if (fixes.length) {
      await call(this.auth, `${this.api}/${this.id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: fixes }) });
    }
  }

  async loadAll(): Promise<LoadResult> {
    await this.ensureSchema();
    const ranges = TABLES.map((t) => `ranges=${encodeURIComponent(`${q(SCHEMA[t].sheet)}!A1:ZZ`)}`).join('&');
    const got = await call<BatchGet>(this.auth, `${this.api}/${this.id}/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&${ranges}`);
    const db = emptyDB() as Record<TableName, unknown[]>;
    const warnings: string[] = [];
    TABLES.forEach((t, i) => {
      const vals = got.valueRanges[i]?.values ?? [];
      const head = (vals[0] ?? this.heads.get(t) ?? headers(t)).map((x) => String(x).trim());
      const seen = new Set<string>();
      let dup = 0;
      for (const row of vals.slice(1)) {
        const rec = fromRow(t, head, row);
        if (!rec) continue;
        if (seen.has(rec.id)) { dup++; continue; }
        seen.add(rec.id);
        db[t].push(rec);
      }
      if (dup) warnings.push(`${SCHEMA[t].sheet}: ignored ${dup} duplicate row${dup > 1 ? 's' : ''} (same id).`);
    });
    return { db: db as DB, warnings };
  }

  private head(t: TableName): string[] { return this.heads.get(t) ?? headers(t); }

  /** 1-based sheet row numbers for each id (row 1 is the header). */
  private async rowsOf(t: TableName, ids: string[]): Promise<Map<string, number[]>> {
    const idCol = colLetter(this.head(t).indexOf('id') + 1 || 1);
    const r = await call<{ values?: unknown[][] }>(this.auth, `${this.api}/${this.id}/values/${encodeURIComponent(`${q(SCHEMA[t].sheet)}!${idCol}:${idCol}`)}?valueRenderOption=UNFORMATTED_VALUE`);
    const out = new Map<string, number[]>();
    (r.values ?? []).forEach((v, i) => {
      const id = String(v?.[0] ?? '');
      if (i > 0 && ids.includes(id)) out.set(id, [...(out.get(id) ?? []), i + 1]);
    });
    return out;
  }

  private aligned<T extends TableName>(t: T, rec: Tables[T]): (string | number | boolean)[] {
    const want = headers(t), vals = toRow(t, rec), head = this.head(t);
    return head.map((h) => { const i = want.indexOf(h); return i >= 0 ? vals[i] : ''; });
  }

  async upsert<T extends TableName>(t: T, rec: Tables[T]): Promise<void> {
    if (!this.heads.size) await this.ensureSchema();
    const rows = (await this.rowsOf(t, [rec.id])).get(rec.id);
    const values = [this.aligned(t, rec)];
    if (rows?.length) {
      const n = rows[0];
      const range = `${q(SCHEMA[t].sheet)}!A${n}:${colLetter(this.head(t).length)}${n}`;
      await call(this.auth, `${this.api}/${this.id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) });
    } else {
      const range = `${q(SCHEMA[t].sheet)}!A1`;
      await call(this.auth, `${this.api}/${this.id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) });
    }
  }

  async remove(items: { table: TableName; ids: string[] }[]): Promise<void> {
    if (!this.heads.size) await this.ensureSchema();
    const requests: { deleteDimension: { range: { sheetId: number; dimension: 'ROWS'; startIndex: number; endIndex: number } } }[] = [];
    for (const { table, ids } of items) {
      if (!ids.length) continue;
      const sheetId = this.sheetIds.get(SCHEMA[table].sheet);
      if (sheetId == null) continue;
      const found = await this.rowsOf(table, ids);
      const rows = [...found.values()].flat().sort((a, b) => b - a); // bottom-up keeps indexes valid
      rows.forEach((n) => requests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: n - 1, endIndex: n } } }));
    }
    if (!requests.length) return;
    await call(this.auth, `${this.api}/${this.id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  }
}
