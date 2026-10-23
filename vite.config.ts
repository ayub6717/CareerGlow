import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sheetsProxy } from './server/sheetsProxy';

export default defineConfig({
  plugins: [react(), tailwindcss(), sheetsProxy()],
  server: { port: 5173, host: true },
});
