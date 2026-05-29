import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The bot's Node HTTP server serves this build under the URL prefix
 * `/webapp/` (see src/bot/webhook.ts → serveWebApp). All hashed assets
 * therefore have to load from `/webapp/assets/…`, which we configure
 * via Vite's `base` setting.
 *
 * In dev mode (`npm run dev`) we proxy `/api/*` to the bot's HTTP
 * server on port 3000 so the same code runs against real data.
 */
export default defineConfig({
  base: '/webapp/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
});
