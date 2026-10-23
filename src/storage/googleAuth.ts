/**
 * Google sign-in for a backend-free app, using Google Identity Services (OAuth 2.0 token model).
 * - Only the public OAuth Client ID is used. No client secret exists in this app.
 * - The access token lives in memory only (never written to localStorage) and expires after ~1 hour;
 *   it is refreshed silently when possible.
 */

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string; scope: string; callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}
declare global {
  interface Window { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Google sign-in. Check your connection.')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export class GoogleAuth {
  private token: string | null = null;
  private expiresAt = 0;
  private client: TokenClient | null = null;
  private pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;
  readonly clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  get signedIn(): boolean {
    return !!this.token && Date.now() < this.expiresAt;
  }

  private async ensureClient(): Promise<TokenClient> {
    await loadScript();
    if (this.client) return this.client;
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('Google sign-in is unavailable.');
    this.client = oauth2.initTokenClient({
      client_id: this.clientId,
      scope: SHEETS_SCOPE,
      callback: (r) => {
        const p = this.pending; this.pending = null;
        if (!p) return;
        if (r.error || !r.access_token) { p.reject(new Error(r.error_description || r.error || 'Sign-in was cancelled.')); return; }
        this.token = r.access_token;
        this.expiresAt = Date.now() + ((r.expires_in ?? 3600) - 120) * 1000;
        p.resolve(r.access_token);
      },
      error_callback: (e) => {
        const p = this.pending; this.pending = null;
        p?.reject(new Error(e.type === 'popup_closed' ? 'The Google sign-in window was closed.' : e.message || 'Google sign-in failed.'));
      },
    });
    return this.client;
  }

  /** Must be called from a user gesture (click) the first time, so the popup isn't blocked. */
  async signIn(interactive = true): Promise<string> {
    const client = await this.ensureClient();
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
  }

  async getToken(): Promise<string> {
    if (this.signedIn && this.token) return this.token;
    return this.signIn(false);
  }

  /** Forget the token so the next call re-authorises (used after a 401). */
  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  signOut(): void {
    const t = this.token;
    this.invalidate();
    if (t) window.google?.accounts?.oauth2?.revoke(t);
  }
}
