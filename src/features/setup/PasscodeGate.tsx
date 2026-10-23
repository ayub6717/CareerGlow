import { useEffect, useState, type ReactNode } from 'react';
import { getPasscode, savePasscode } from '../../config';

type State = 'checking' | 'locked' | 'open';

/** Service-account mode on a public deploy: asks for the site passcode once per device, then remembers it. */
export default function PasscodeGate({ spreadsheetId, children }: { spreadsheetId: string; children: ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const check = async (pass: string): Promise<boolean> => {
    try {
      const r = await fetch(`/api/sheets/${spreadsheetId}?fields=spreadsheetId`, { headers: { 'X-App-Passcode': pass } });
      return r.status !== 401;
    } catch { return true; } // offline etc. — let the app show its own error
  };

  useEffect(() => { void check(getPasscode()).then((ok) => setState(ok ? 'open' : 'locked')); }, [spreadsheetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setState('checking');
    if (await check(code)) { savePasscode(code); setState('open'); }
    else { setError('Wrong passcode.'); setState('locked'); }
  };

  if (state === 'open') return <>{children}</>;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 pt-safe">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="size-10" />
          <div><div className="font-display text-2xl font-bold tracking-tight">Blueprint</div><div className="text-sm text-mute">Plan it. Fund it. Finish it.</div></div>
        </div>
        <div className="card flex flex-col gap-4">
          {state === 'checking' ? (
            <div className="flex items-center gap-3 py-4" role="status"><span className="size-5 animate-spin rounded-full border-2 border-pri-soft border-t-pri" />Checking…</div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <h1 className="h2">Enter passcode</h1>
                <p className="mt-1.5 text-[15px] text-mute">Asked once on this device, then remembered.</p>
              </div>
              <input className="input" type="password" autoComplete="current-password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={!code}>Unlock</button>
            </form>
          )}
          {error && <div role="alert" className="soft bg-rose-soft text-[15px] text-rose-ink">{error}</div>}
        </div>
      </div>
    </div>
  );
}
