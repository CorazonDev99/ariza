import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { detectLocale, getTg, type Locale } from './tg';
import { TypePage } from './pages/TypePage';
import { RegionPage } from './pages/RegionPage';
import { CourtPage } from './pages/CourtPage';
import { DatePage } from './pages/DatePage';
import { SchedulePage } from './pages/SchedulePage';

export interface JadvalState {
  type: string | null;
  region: string | null;
  court: string | null;
  date: string | null; // YYYY-MM-DD
}

const INITIAL: JadvalState = { type: null, region: null, court: null, date: null };

export function App() {
  const [locale] = useState<Locale>(detectLocale());
  const [state, setState] = useState<JadvalState>(INITIAL);

  // Sync the Telegram BackButton with router state — when the user is
  // not on the root, show it; tapping it walks back through our flow.
  // This is handled by useTelegramBack inside each page so it stays
  // colocated with route-specific back behavior.

  useEffect(() => {
    // Disable closing-confirmation on Android — Telegram lets the WebApp
    // ask "Are you sure you want to close?" but we have no unsaved state.
    const tg = getTg();
    tg.MainButton.hide();
  }, []);

  return (
    <div className="min-h-full bg-tg-secondary-bg text-tg-text safe-bottom">
      <Routes>
        <Route path="/" element={<TypePage locale={locale} setState={setState} />} />
        <Route
          path="/region"
          element={<RegionPage locale={locale} state={state} setState={setState} />}
        />
        <Route
          path="/court"
          element={<CourtPage locale={locale} state={state} setState={setState} />}
        />
        <Route
          path="/date"
          element={<DatePage locale={locale} state={state} setState={setState} />}
        />
        <Route
          path="/schedule"
          element={<SchedulePage locale={locale} state={state} />}
        />
      </Routes>
    </div>
  );
}

/** Wire the Telegram BackButton to a router navigate target while a
 *  page is mounted. Hides the button on unmount. */
export function useTelegramBack(onBack: () => void) {
  useEffect(() => {
    const tg = getTg();
    const handler = () => onBack();
    tg.BackButton.show();
    tg.BackButton.onClick(handler);
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [onBack]);
}

/** Navigate-by-default back hook for pages: pop one level. */
export function useBackTo(target: string) {
  const nav = useNavigate();
  useTelegramBack(() => nav(target));
}
