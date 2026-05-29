import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { getTg } from './tg';
import { App } from './App';
import './styles.css';

/**
 * Initialise the Telegram WebApp connection BEFORE React mounts so the
 * theme variables are present from the very first paint. We use HashRouter
 * (not BrowserRouter) because Telegram's WebView passes path information
 * in ways that conflict with HTML5 history — hash-based routes always
 * resolve correctly.
 */
const tg = getTg();
tg.ready();
tg.expand();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
