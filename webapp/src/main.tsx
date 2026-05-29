import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getTg } from './tg';
import { App } from './App';
import './styles.css';

/**
 * Initialise the Telegram WebApp connection BEFORE React mounts so the
 * theme variables are present from the very first paint.
 *
 * We use MemoryRouter (not Hash- or BrowserRouter) because Telegram's
 * Mini App container appends its own data to the URL fragment, e.g.
 *   /webapp#tgWebAppData=user%3D...&tgWebAppVersion=8.0&...
 * That fragment hijacks HashRouter, leaving no route matched and a
 * blank screen — the exact symptom we hit. MemoryRouter sidesteps the
 * URL entirely: navigation is in-memory only, no fragment, no path.
 * Deep linking isn't useful here anyway since the user always enters
 * the Mini App via the bot's menu button.
 */
const tg = getTg();
tg.ready();
tg.expand();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MemoryRouter>
      <App />
    </MemoryRouter>
  </React.StrictMode>,
);
