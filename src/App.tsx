import { useMemo, useState } from 'react';
import { GOOGLE_CLIENT_ID, USE_SERVICE_ACCOUNT, getSavedSpreadsheetId, hasClientId, saveSpreadsheetId } from './config';
import { GoogleAuth } from './storage/googleAuth';
import { DemoStorage, GoogleSheetsStorage, type StorageService } from './storage/storage';
import { DataProvider } from './storage/DataContext';
import { demoDB } from './lib/seed';
import ConnectScreen from './features/setup/ConnectScreen';
import AppShell from './components/layout/AppShell';

const SA_SHEET = (import.meta.env.VITE_SPREADSHEET_ID ?? '').trim();

export default function App() {
  if (USE_SERVICE_ACCOUNT && SA_SHEET) return <ServiceAccountApp spreadsheetId={SA_SHEET} />;
  return <OAuthApp />;
}

/** No sign-in: every request goes through the local /api/sheets proxy. */
function ServiceAccountApp({ spreadsheetId }: { spreadsheetId: string }) {
  const storage = useMemo(() => new GoogleSheetsStorage(null, spreadsheetId), [spreadsheetId]);
  return (
    <DataProvider key={spreadsheetId} storage={storage}>
      <AppShell />
    </DataProvider>
  );
}

function OAuthApp() {
  const auth = useMemo(() => (hasClientId() ? new GoogleAuth(GOOGLE_CLIENT_ID) : null), []);
  const [storage, setStorage] = useState<StorageService | null>(null);

  if (!storage) {
    return (
      <ConnectScreen
        auth={auth}
        savedId={getSavedSpreadsheetId()}
        onReady={(id) => { saveSpreadsheetId(id); setStorage(new GoogleSheetsStorage(auth!, id)); }}
        onDemo={() => setStorage(new DemoStorage(demoDB()))}
      />
    );
  }

  const disconnect = (forget: boolean) => {
    if (forget) saveSpreadsheetId(null);
    if (storage.kind === 'google') auth?.signOut();
    setStorage(null);
  };

  return (
    <DataProvider key={storage instanceof GoogleSheetsStorage ? storage.id : 'demo'} storage={storage}>
      <AppShell onDisconnect={disconnect} />
    </DataProvider>
  );
}
