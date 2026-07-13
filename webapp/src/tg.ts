/**
 * Thin typed wrapper over window.Telegram.WebApp. The SDK is loaded
 * via <script> in index.html, so it's available synchronously on
 * first render. We narrow the parts of the API we actually use and
 * fall back to no-ops when running outside Telegram (e.g. `vite dev`
 * in a regular browser).
 *
 * Docs: https://core.telegram.org/bots/webapps#initializing-mini-apps
 */

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TgMainButton {
  text: string;
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  setText: (text: string) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
}

export interface TgBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

export interface TgHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; auth_date?: number; query_id?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TgThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: TgMainButton;
  BackButton: TgBackButton;
  HapticFeedback: TgHapticFeedback;
  showAlert: (msg: string, cb?: () => void) => void;
  showConfirm: (msg: string, cb?: (ok: boolean) => void) => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent: (event: string, cb: () => void) => void;
  /** Open a URL in the system/in-app browser (since 6.1). */
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  /** Native file download to the device (Bot API 8.0+). Absent on older
   *  clients — callers must fall back to openLink. */
  downloadFile?: (
    params: { url: string; file_name: string },
    callback?: (accepted: boolean) => void,
  ) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TgWebApp;
    };
  }
}

/** Returns the WebApp instance or a no-op shim for non-Telegram envs. */
export function getTg(): TgWebApp {
  const tg = window.Telegram?.WebApp;
  if (tg) return tg;
  return SHIM;
}

/**
 * Capture initData ONCE at module load. Some Telegram clients (notably
 * Android with certain build channels) clear the URL fragment after
 * `WebApp.ready()` so a later read of `getTg().initData` returns "".
 * That breaks every authenticated API call.
 *
 * We snapshot the value here while it's still populated, and also
 * persist it to sessionStorage as a belt-and-braces fallback for cases
 * where the Mini App's container reloads the iframe mid-session.
 */
const SNAPSHOT_KEY = 'tg:initData';
function snapshotInitData(): string {
  const live = window.Telegram?.WebApp?.initData ?? '';
  if (live) {
    try { sessionStorage.setItem(SNAPSHOT_KEY, live); } catch { /* private mode */ }
    return live;
  }
  try { return sessionStorage.getItem(SNAPSHOT_KEY) ?? ''; } catch { return ''; }
}
const INIT_DATA_AT_BOOT = snapshotInitData();

/** Stable initData for the lifetime of this WebApp session. Prefer the
 *  fresh value if the client kept it around; otherwise replay the
 *  snapshot captured on first load. */
export function getInitData(): string {
  const live = window.Telegram?.WebApp?.initData ?? '';
  return live || INIT_DATA_AT_BOOT;
}

const noop = () => {};
const SHIM: TgWebApp = {
  initData: '',
  initDataUnsafe: {},
  version: '0.0',
  platform: 'unknown',
  colorScheme: 'light',
  themeParams: {},
  isExpanded: true,
  viewportHeight: window.innerHeight,
  ready: noop,
  expand: noop,
  close: noop,
  MainButton: {
    text: '',
    isVisible: false,
    show: noop,
    hide: noop,
    setText: noop,
    onClick: noop,
    offClick: noop,
    enable: noop,
    disable: noop,
    showProgress: noop,
    hideProgress: noop,
  },
  BackButton: {
    isVisible: false,
    show: noop,
    hide: noop,
    onClick: noop,
    offClick: noop,
  },
  HapticFeedback: {
    impactOccurred: noop,
    notificationOccurred: noop,
    selectionChanged: noop,
  },
  showAlert: (msg) => window.alert(msg),
  showConfirm: (msg, cb) => cb?.(window.confirm(msg)),
  onEvent: noop,
  offEvent: noop,
  openLink: (url) => window.open(url, '_blank'),
};

/** Pick the user's preferred locale based on their Telegram language. */
export type Locale = 'uz_cyrillic' | 'uz_latin' | 'ru';
export function detectLocale(): Locale {
  const code = getTg().initDataUnsafe.user?.language_code?.toLowerCase();
  if (code === 'ru') return 'ru';
  // Telegram uses 'uz' for both scripts. Default to Cyrillic — it's the
  // most common in Uzbekistan; users can flip later via /lang in the bot.
  return 'uz_cyrillic';
}
