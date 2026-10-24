/** Only non-secret configuration lives in the frontend. */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
/** Apps Script mode: no sign-in; requests go to the user's deployed Apps Script web app (apps-script/Code.gs). */
export const APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim();
export const hasClientId = (): boolean => /\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);

const KEY = 'blueprint.spreadsheetId';
/** The spreadsheet id is a pointer, not data — remembering it in the browser is fine. */
export function getSavedSpreadsheetId(): string {
  try { return localStorage.getItem(KEY) || (import.meta.env.VITE_SPREADSHEET_ID ?? '').trim(); } catch { return (import.meta.env.VITE_SPREADSHEET_ID ?? '').trim(); }
}
export function saveSpreadsheetId(id: string | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
