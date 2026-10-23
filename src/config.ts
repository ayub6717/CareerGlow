/** Only non-secret configuration lives in the frontend. */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
/** Service-account mode: no sign-in; the dev server's /api/sheets proxy holds the key. */
export const USE_SERVICE_ACCOUNT = (import.meta.env.VITE_SHEETS_MODE ?? '').trim() === 'service-account';
export const hasClientId = (): boolean => /\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);

const KEY = 'blueprint.spreadsheetId';
/** The spreadsheet id is a pointer, not data — remembering it in the browser is fine. */
export function getSavedSpreadsheetId(): string {
  try { return localStorage.getItem(KEY) || (import.meta.env.VITE_SPREADSHEET_ID ?? '').trim(); } catch { return (import.meta.env.VITE_SPREADSHEET_ID ?? '').trim(); }
}
export function saveSpreadsheetId(id: string | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
