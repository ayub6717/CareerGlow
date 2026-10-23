import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sheetsProxy } from './server/sheetsProxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      sheetsProxy({ spreadsheetId: env.VITE_SPREADSHEET_ID ?? '', passcode: env.APP_PASSCODE || undefined, keyFile: env.GOOGLE_SERVICE_ACCOUNT_FILE }),
    ],
    server: { port: 5173, host: true },
  };
});
