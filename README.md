# Blueprint — Life Planner

A personal planning app: goals with automatic money and time maths, tasks, wallets and spending, a budget
calculator, reminders, a job-application tracker and a skills tracker with automatic progress.
Built mobile-first for iPhone 16 Pro / Pro Max, with a calm light theme.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4. No backend — data is stored in **your own Google Sheet**.

## Quick start

```bash
npm install
cp .env.example .env.local     # then put your Google OAuth Client ID in it
npm run dev                    # http://localhost:5173
```

First time? Follow **[docs/GOOGLE_SHEETS_SETUP.md](docs/GOOGLE_SHEETS_SETUP.md)** to create the Client ID.
Without it, the app opens a setup screen and offers a clearly labelled **demo mode** (sample data, nothing saved).

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |

## Project structure

```
src/
  App.tsx                 connect flow → storage → app
  config.ts               env config (Client ID is public; no secrets)
  router.ts               tiny hash router (#/jobs, #/goal/<id>)
  types.ts                all entity types (one per worksheet)
  storage/
    schema.ts             worksheet names, columns, row ⇄ record mapping, cascades
    googleAuth.ts         Google Identity Services OAuth token client
    storage.ts            StorageService interface, GoogleSheetsStorage, DemoStorage
    DataContext.tsx       app state, write queue, debounced saves, retry, sync, unsaved-changes guard
  lib/                    formatting, parsing (120k, 1.5 lakh, outlines), calculations, sample data
  components/ui           shared building blocks (cards, pills, progress bars, chips…)
  components/layout       sidebar, mobile top bar, bottom tabs, More sheet
  features/               overview, goals, tasks, money, reminders, career (jobs, skills), content, review
docs/                     Google setup guide and spreadsheet schema
```

## How saving works

- Every change updates the screen immediately, then is written to Google Sheets through a **single ordered queue**.
- Typing is **debounced** (~0.7 s) so a sentence becomes one write, not one per key.
- Writes are **upserts by id**: the app looks the row up by its id before writing, so a retried request can't create a duplicate.
- If a write fails, your change stays on screen, a **Not saved — Retry** button appears, and closing the tab asks for confirmation.
- When you come back to the tab (after 30 s+, with nothing unsaved) the app reloads from the sheet, so edits made directly in Google Sheets show up. **Refresh** does it on demand.
- Duplicate ids in the sheet are ignored (first row wins) and reported in a notice.

See [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) for every tab and column.
