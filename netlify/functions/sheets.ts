/**
 * Netlify Function: the deployed site's /api/sheets proxy. Same handler as the dev server.
 * Set these in Netlify → Site configuration → Environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  the service-account key file's contents
 *   APP_PASSCODE                 required on a public site — asked once per device
 *   VITE_SPREADSHEET_ID          also used by the build
 */
import { createSheetsHandler } from '../../server/sheetsHandler';

const PREFIX = '/api/sheets';

const handle = createSheetsHandler({
  credentials: () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set in Netlify.');
    return raw;
  },
  spreadsheetId: process.env.VITE_SPREADSHEET_ID ?? '',
  passcode: process.env.APP_PASSCODE || undefined,
});

export default async (req: Request): Promise<Response> => {
  if (!process.env.APP_PASSCODE) {
    return Response.json({ error: { code: 503, message: 'APP_PASSCODE is not set in Netlify — refusing to expose the sheet publicly.' } }, { status: 503 });
  }
  const url = new URL(req.url);
  const r = await handle({
    method: req.method,
    path: url.pathname.slice(PREFIX.length) + url.search,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
    passcode: req.headers.get('x-app-passcode'),
  });
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.contentType, 'Cache-Control': 'no-store' } });
};

export const config = { path: `${PREFIX}/*` };
