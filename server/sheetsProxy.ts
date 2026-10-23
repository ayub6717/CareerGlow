/**
 * Vite dev/preview middleware: the browser calls /api/sheets/..., this forwards it via the shared handler.
 * The key is read from service-account.json on this machine and never sent to the browser.
 * The spreadsheet must be shared (Editor) with the service account's email.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { createSheetsHandler } from './sheetsHandler';

const PREFIX = '/api/sheets';

export function sheetsProxy(opts: { spreadsheetId: string; passcode?: string; keyFile?: string }): Plugin {
  const path = resolve(opts.keyFile || 'service-account.json');
  const handle = createSheetsHandler({
    spreadsheetId: opts.spreadsheetId,
    passcode: opts.passcode,
    credentials: () => {
      if (!existsSync(path)) throw new Error(`Service-account key not found at ${path}. See docs/GOOGLE_SHEETS_SETUP.md.`);
      return readFileSync(path, 'utf8');
    },
  });

  const attach = (server: { middlewares: { use: (p: string, h: (req: any, res: any) => void) => void } }) => {
    server.middlewares.use(PREFIX, async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const r = await handle({
        method: req.method,
        path: req.url,
        body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined,
        passcode: req.headers['x-app-passcode'],
      });
      res.statusCode = r.status;
      res.setHeader('Content-Type', r.contentType);
      res.end(r.body);
    });
  };

  return { name: 'sheets-proxy', configureServer: attach, configurePreviewServer: attach };
}
