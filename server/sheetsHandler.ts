/**
 * Shared proxy core for the Vite dev server and the Netlify function: forwards a request to the
 * Google Sheets API, signed with a service-account key. The key never reaches the browser.
 *
 * Guards (both matter once the app is on a public URL):
 * - only the configured spreadsheet can be touched;
 * - if a passcode is configured, every request must send it in the X-App-Passcode header.
 */
import { timingSafeEqual } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface ProxyConfig {
  /** Service-account JSON (the downloaded key file's contents). */
  credentials: () => string;
  spreadsheetId: string;
  passcode?: string;
}
export interface ProxyRequest { method: string; path: string; body?: string; passcode?: string | null }
export interface ProxyResponse { status: number; body: string; contentType: string }

const json = (status: number, message: string): ProxyResponse =>
  ({ status, body: JSON.stringify({ error: { code: status, message } }), contentType: 'application/json' });

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createSheetsHandler(cfg: ProxyConfig) {
  let auth: GoogleAuth | null = null;

  return async function handle(req: ProxyRequest): Promise<ProxyResponse> {
    if (cfg.passcode && !same(req.passcode ?? '', cfg.passcode)) return json(401, 'Passcode required.');
    if (!cfg.spreadsheetId) return json(500, 'Server is missing the spreadsheet id (VITE_SPREADSHEET_ID).');
    // "/<id>", "/<id>?…", "/<id>/values/…", "/<id>:batchUpdate" — nothing else.
    if (!new RegExp(`^/${cfg.spreadsheetId}(?:[/?:]|$)`).test(req.path)) return json(403, 'This proxy only serves the configured spreadsheet.');
    try {
      auth ??= new GoogleAuth({ credentials: JSON.parse(cfg.credentials()), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
      const token = await auth.getAccessToken();
      const r = await fetch(API + req.path, {
        method: req.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      });
      return { status: r.status, body: await r.text(), contentType: r.headers.get('content-type') || 'application/json' };
    } catch (e) {
      auth = null;
      return json(500, e instanceof Error ? e.message : 'Proxy error');
    }
  };
}
