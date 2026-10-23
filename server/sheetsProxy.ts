/**
 * Local proxy: the browser calls /api/sheets/..., this forwards the request to the Google Sheets API
 * signed with a service-account key. The key stays on this machine — it is never sent to the browser.
 * The spreadsheet must be shared (Editor) with the service account's email.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { GoogleAuth } from 'google-auth-library';

const PREFIX = '/api/sheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function sheetsProxy(keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'service-account.json'): Plugin {
  const path = resolve(keyFile);
  let auth: GoogleAuth | null = null;
  const client = () => {
    if (!existsSync(path)) throw new Error(`Service-account key not found at ${path}. See docs/GOOGLE_SHEETS_SETUP.md.`);
    auth ??= new GoogleAuth({ credentials: JSON.parse(readFileSync(path, 'utf8')), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return auth;
  };

  const attach = (server: { middlewares: { use: (p: string, h: (req: any, res: any) => void) => void } }) => {
    server.middlewares.use(PREFIX, async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
        const token = await client().getAccessToken();
        const r = await fetch(API + (req.url === '/' ? '' : req.url), {
          method: req.method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        });
        res.statusCode = r.status;
        res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
        res.end(await r.text());
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { message: e instanceof Error ? e.message : 'Proxy error' } }));
      }
    });
  };

  return { name: 'sheets-proxy', configureServer: attach, configurePreviewServer: attach };
}
