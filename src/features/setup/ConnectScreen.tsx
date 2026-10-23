import { useState } from 'react';
import type { GoogleAuth } from '../../storage/googleAuth';
import { GoogleSheetsStorage, parseSpreadsheetId } from '../../storage/storage';
import { Icon } from '../../components/ui';

type Step = 'signin' | 'choose' | 'busy';

export default function ConnectScreen({ auth, savedId, onReady, onDemo }: {
  auth: GoogleAuth | null; savedId: string; onReady: (spreadsheetId: string) => void; onDemo: () => void;
}) {
  const [step, setStep] = useState<Step>('signin');
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [busyText, setBusyText] = useState('');

  const signIn = async () => {
    if (!auth) return;
    setError(''); setStep('busy'); setBusyText('Waiting for Google sign-in…');
    try {
      await auth.signIn(true);
      if (savedId) { setBusyText('Opening your spreadsheet…'); await open(savedId); }
      else setStep('choose');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); setStep('signin'); }
  };

  const open = async (id: string) => {
    setError(''); setStep('busy'); setBusyText('Checking the spreadsheet and adding any missing tabs…');
    try {
      await new GoogleSheetsStorage(auth!, id).ensureSchema();
      onReady(id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the spreadsheet.'); setStep('choose'); }
  };

  const create = async () => {
    setError(''); setStep('busy'); setBusyText('Creating “Blueprint — Life Planner” in your Google Drive…');
    try { onReady(await GoogleSheetsStorage.create(auth!, 'Blueprint — Life Planner')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create the spreadsheet.'); setStep('choose'); }
  };

  const useExisting = () => {
    const id = parseSpreadsheetId(link);
    if (!id) { setError('That doesn’t look like a Google Sheets link. Copy the full address from the browser bar.'); return; }
    void open(id);
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 pt-safe">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="size-10" />
          <div><div className="font-display text-2xl font-bold tracking-tight">Blueprint</div><div className="text-sm text-mute">Plan it. Fund it. Finish it.</div></div>
        </div>

        <div className="card flex flex-col gap-4">
          {!auth ? (
            <>
              <div>
                <h1 className="h2">Connect Google Sheets</h1>
                <p className="mt-1.5 text-[15px] text-mute">Your data is stored in a Google Sheet you own. To turn that on, this app needs a Google OAuth Client ID.</p>
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">
                <li>Follow <strong className="font-semibold">docs/GOOGLE_SHEETS_SETUP.md</strong> in the project folder (about 10 minutes).</li>
                <li>Put the Client ID in a <code className="num rounded bg-line-soft px-1 text-[13px]">.env.local</code> file as <code className="num rounded bg-line-soft px-1 text-[13px]">VITE_GOOGLE_CLIENT_ID</code>.</li>
                <li>Restart <code className="num rounded bg-line-soft px-1 text-[13px]">npm run dev</code>.</li>
              </ol>
            </>
          ) : step === 'busy' ? (
            <div className="flex items-center gap-3 py-4" role="status"><span className="size-5 animate-spin rounded-full border-2 border-pri-soft border-t-pri" />{busyText}</div>
          ) : step === 'signin' ? (
            <>
              <div>
                <h1 className="h2">Sign in to load your data</h1>
                <p className="mt-1.5 text-[15px] text-mute">Everything is saved in your own Google Sheet. The app only asks for access to spreadsheets.</p>
              </div>
              <button className="btn btn-primary" onClick={signIn}>Continue with Google</button>
            </>
          ) : (
            <>
              <div>
                <h1 className="h2">Choose your spreadsheet</h1>
                <p className="mt-1.5 text-[15px] text-mute">Create a new one with all the tabs set up, or connect a sheet you already use for Blueprint.</p>
              </div>
              <button className="btn btn-primary" onClick={create}><Icon name="sheet" size={18} />Create a new spreadsheet</button>
              <div className="flex items-center gap-3 text-[13px] text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
              <label className="flex flex-col gap-1.5">
                <span className="lbl">Existing spreadsheet link</span>
                <input className="input" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="https://docs.google.com/spreadsheets/d/…" value={link} onChange={(e) => setLink(e.target.value)} />
              </label>
              <button className="btn btn-ghost" onClick={useExisting}>Use this spreadsheet</button>
              <p className="text-[13px] text-mute">Missing tabs and header columns are added automatically. Existing rows are never deleted.</p>
            </>
          )}
          {error && <div role="alert" className="soft bg-rose-soft text-[15px] text-rose-ink">{error}</div>}
        </div>

        <button className="btn btn-quiet mt-4 w-full" onClick={onDemo}>Look around with sample data (nothing is saved)</button>
      </div>
    </div>
  );
}
