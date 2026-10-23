# Google Sheets setup (about 10 minutes)

Blueprint has no backend. It talks to the **Google Sheets API directly from your browser**, using
**Google sign-in (OAuth 2.0)**. You only need a public **OAuth Client ID**.

> **Never** put a client secret, a service-account JSON key, or an API key with write access in this
> project. The app doesn't need any of them, and anything in a frontend is visible to everyone.

## 1. Create a Google Cloud project

1. Open <https://console.cloud.google.com/> and sign in with the Google account that should own the data.
2. Top bar → project picker → **New project** → name it `Blueprint` → **Create**, then select it.

## 2. Turn on the Google Sheets API

1. Menu → **APIs & Services → Library**.
2. Search **Google Sheets API** → open it → **Enable**.

## 3. Configure the consent screen

Menu → **Google Auth Platform** (older consoles call this **APIs & Services → OAuth consent screen**).

1. **Branding**: App name `Blueprint`, your email as support and developer contact → **Save**.
2. **Audience**: User type **External**, publishing status **Testing**.
   Under **Test users** → **Add users** → add your own Gmail address. Only test users can sign in.
3. **Data access** → **Add or remove scopes** → tick
   `https://www.googleapis.com/auth/spreadsheets` (*See, edit, create and delete all your Google Sheets*) → **Update** → **Save**.

## 4. Create the OAuth Client ID

1. **Google Auth Platform → Clients** (or **APIs & Services → Credentials → Create credentials → OAuth client ID**).
2. Application type: **Web application**. Name: `Blueprint web`.
3. **Authorized JavaScript origins** → add:
   - `http://localhost:5173`
   - your live address later, e.g. `https://your-site.netlify.app` (must be **https**)
4. Leave **Authorized redirect URIs** empty → **Create**.
5. Copy the **Client ID** (ends with `.apps.googleusercontent.com`). Ignore the client secret — never copy it into the project.

## 5. Add the Client ID to the project

Create a file named **`.env.local`** in the project folder (it is git-ignored):

```
VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

## 6. Run and connect

```bash
npm install
npm run dev
```

Open <http://localhost:5173> in Chrome:

1. **Continue with Google** → choose your account.
2. Google shows *“Google hasn’t verified this app”* because it is in Testing mode and only for you → **Continue**.
3. Allow access to Google Sheets.
4. **Create a new spreadsheet** (recommended) — or paste the link of an existing Blueprint sheet.

A spreadsheet called **Blueprint — Life Planner** appears in your Google Drive with all tabs and header rows.
The app remembers which spreadsheet to open (only its id, in this browser). Your data lives in the sheet.

## Using it on your iPhone

Google only accepts sign-in from `http://localhost` or an **https** address, so `http://192.168.x.x:5173`
from your phone will be refused. To use Blueprint on iPhone 16 Pro / Pro Max:

1. `npm run build` → deploy the `dist/` folder to any static host with https (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
2. Add that https address to **Authorized JavaScript origins** (step 4).
3. Set the same `VITE_GOOGLE_CLIENT_ID` as an environment variable on the host before building.
4. In Safari: open the site → Share → **Add to Home Screen** for an app-like experience.

## How sign-in behaves

- The access token lives only in memory and lasts about an hour; Blueprint asks Google for a fresh one when needed.
- After a page reload you tap **Continue with Google** once (browsers block sign-in pop-ups that aren't triggered by a tap).
- **Sign out** (sidebar or *More* menu) revokes the token. **Switch sheet** lets you choose a different spreadsheet.

## Troubleshooting

| Message | Fix |
|---|---|
| `Error 400: redirect_uri_mismatch` / `origin_mismatch` | The address in the browser bar isn't listed in **Authorized JavaScript origins**. Add it exactly (scheme + host + port). |
| `Access blocked: … has not completed the Google verification process` | Add your Gmail under **Audience → Test users**. |
| `Google Sheets API has not been used in project … or it is disabled` | Step 2 — enable the Sheets API in the same project as the Client ID. |
| `No permission to use this spreadsheet` | Sign in with the account that owns (or can edit) the sheet. |
| Sign-in window doesn't open | Allow pop-ups for the site; tap the button again. |

## No-sign-in mode (service account) — currently used

Instead of signing in each time, the dev server can talk to Sheets with a **service account**:

1. Google Cloud → **IAM & Admin → Service accounts** → create one → **Keys → Add key → JSON**.
2. Save the file as **`service-account.json`** in the project folder (git-ignored; never commit or deploy it).
3. Share the spreadsheet with the service account's email (`…@….iam.gserviceaccount.com`) as **Editor**.
4. In `.env.local`:
   ```
   VITE_SHEETS_MODE=service-account
   VITE_SPREADSHEET_ID=<the id from the sheet's URL>
   ```
5. `yarn dev` — the app opens straight into your data. The browser calls `/api/sheets/…`; the proxy in
   `server/sheetsProxy.ts` signs each request with the key, which never reaches the browser.

This works while `yarn dev` (or `yarn preview`) runs on your Mac. A static deploy has no proxy, so using it
on iPhone needs the proxy deployed as a serverless function, or the OAuth mode above.
