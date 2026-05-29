/**
 * The bot's Node HTTP server serves this build under the URL prefix
 * `/webapp/` (see src/bot/webhook.ts → serveWebApp). All hashed assets
 * therefore have to load from `/webapp/assets/…`, which we configure
 * via Vite's `base` setting.
 *
 * In dev mode (`npm run dev`) we proxy `/api/*` to the bot's HTTP
 * server on port 3000 so the same code runs against real data.
 */
declare const _default: import("vite").UserConfig;
export default _default;
