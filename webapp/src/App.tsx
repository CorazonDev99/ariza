import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { detectLocale, getTg, type Locale } from './tg';
import { api, type MeResponse } from './api';
import { HomePage } from './pages/HomePage';
import { TypePage } from './pages/TypePage';
import { JadvalSubPage } from './pages/JadvalSubPage';
import { RegionPage } from './pages/RegionPage';
import { CourtPage } from './pages/CourtPage';
import { DatePage } from './pages/DatePage';
import { SchedulePage } from './pages/SchedulePage';
import { ArizaTypePage } from './pages/ArizaTypePage';
import { ArizaRegionPage } from './pages/ArizaRegionPage';
import { ArizaCourtPage } from './pages/ArizaCourtPage';
import { ArizaTemplatePage } from './pages/ArizaTemplatePage';
import { ArizaWizardPage } from './pages/ArizaWizardPage';
import { ArizaPreviewPage } from './pages/ArizaPreviewPage';
import { ArizaDonePage } from './pages/ArizaDonePage';
import { GuideTypePage } from './pages/GuideTypePage';
import { GuideTemplatePage } from './pages/GuideTemplatePage';
import { GuideDetailPage } from './pages/GuideDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { InfoRegionPage } from './pages/InfoRegionPage';
import { InfoTypePage } from './pages/InfoTypePage';
import { InfoCourtPage } from './pages/InfoCourtPage';
import { InfoDetailPage } from './pages/InfoDetailPage';
import { AuthGuard } from './components/AuthGuard';

/** Picker state that survives across wizard routes — single source of
 *  truth for which court type / region / court / template is in play. */
export interface PickerState {
  courtType: string | null;
  region: string | null;
  court: string | null;
  template: string | null;
}

/** Schedule-flow state (same shape used previously for jadval). */
export interface JadvalState {
  type: string | null;
  region: string | null;
  court: string | null;
  date: string | null;
}

/** Court-directory (info) flow state: region → type → court. */
export interface InfoState {
  region: string | null;
  type: string | null;
  court: string | null;
}

const EMPTY_PICKER: PickerState = {
  courtType: null,
  region: null,
  court: null,
  template: null,
};
const EMPTY_JADVAL: JadvalState = {
  type: null,
  region: null,
  court: null,
  date: null,
};
const EMPTY_INFO: InfoState = {
  region: null,
  type: null,
  court: null,
};

/**
 * Top-level app: locale + picker + jadval state are kept here and
 * threaded down to pages. Per-template field values use sessionStorage
 * (see ArizaWizardPage) so they survive a route reload but get
 * deliberately wiped on a fresh "📄 Подать заявление" tap.
 */
export function App() {
  const [locale, setLocale] = useState<Locale>(detectLocale());
  const [picker, setPicker] = useState<PickerState>(EMPTY_PICKER);
  const [jadval, setJadval] = useState<JadvalState>(EMPTY_JADVAL);
  const [info, setInfo] = useState<InfoState>(EMPTY_INFO);
  const [me, setMe] = useState<MeResponse | null>(null);

  // Authenticate + sync server-side locale preference.
  useEffect(() => {
    api.me()
      .then((u) => {
        setMe(u);
        // Server preference takes precedence over Telegram language_code.
        if (u.language) setLocale(u.language as Locale);
      })
      .catch(() => {
        /* Will fall back to detectLocale's guess. The unauthenticated
           jadval flow still works because those endpoints are public. */
      });
  }, []);

  useEffect(() => {
    // Always hide the MainButton on App mount — individual pages opt
    // in via useMainButton when they need it.
    getTg().MainButton.hide();
  }, []);

  const ctx = {
    locale,
    setLocale: async (next: Locale) => {
      setLocale(next);
      try {
        const u = await api.setLanguage(next);
        setMe(u);
      } catch {
        /* network — keep local pref */
      }
    },
    picker,
    setPicker,
    jadval,
    setJadval,
    info,
    setInfo,
    me,
    resetPicker: () => setPicker(EMPTY_PICKER),
    resetJadval: () => setJadval(EMPTY_JADVAL),
    resetInfo: () => setInfo(EMPTY_INFO),
  };

  return (
    <div className="min-h-full text-tg-text safe-bottom">
      <Routes>
        <Route path="/" element={<HomePage {...ctx} />} />

        {/* Jadval (court schedule) flow — preserved from v1 */}
        <Route path="/jadval" element={<TypePage locale={locale} setState={setJadval} />} />
        <Route path="/jadval/sub" element={<JadvalSubPage locale={locale} setState={setJadval} />} />
        <Route path="/jadval/region" element={<RegionPage locale={locale} state={jadval} setState={setJadval} />} />
        <Route path="/jadval/court" element={<CourtPage locale={locale} state={jadval} setState={setJadval} />} />
        <Route path="/jadval/date" element={<DatePage locale={locale} state={jadval} setState={setJadval} />} />
        <Route path="/jadval/schedule" element={<SchedulePage locale={locale} state={jadval} />} />

        {/* Ariza (document generation) flow — REQUIRES auth (initData)
         *   so we don't let users fill 20 fields just to fail on Generate. */}
        <Route path="/ariza" element={<AuthGuard><ArizaTypePage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/region" element={<AuthGuard><ArizaRegionPage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/court" element={<AuthGuard><ArizaCourtPage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/template" element={<AuthGuard><ArizaTemplatePage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/wizard" element={<AuthGuard><ArizaWizardPage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/preview" element={<AuthGuard><ArizaPreviewPage {...ctx} /></AuthGuard>} />
        <Route path="/ariza/done" element={<AuthGuard><ArizaDonePage {...ctx} /></AuthGuard>} />

        {/* Guide flow — public (read-only template browser) */}
        <Route path="/guide" element={<GuideTypePage {...ctx} />} />
        <Route path="/guide/templates" element={<GuideTemplatePage {...ctx} />} />
        <Route path="/guide/detail" element={<GuideDetailPage {...ctx} />} />

        {/* Court directory (info) flow — public: type → region → court → card */}
        <Route path="/info" element={<InfoTypePage locale={locale} state={info} setState={setInfo} />} />
        <Route path="/info/region" element={<InfoRegionPage locale={locale} state={info} setState={setInfo} />} />
        <Route path="/info/court" element={<InfoCourtPage locale={locale} state={info} setState={setInfo} />} />
        <Route path="/info/detail" element={<InfoDetailPage locale={locale} state={info} />} />

        {/* About — public, no auth needed */}
        <Route path="/about" element={<AboutPage {...ctx} />} />

        {/* Settings — needs auth (writes User.language) */}
        <Route path="/settings" element={<AuthGuard><SettingsPage {...ctx} /></AuthGuard>} />
      </Routes>
    </div>
  );
}

/** Re-export so jadval pages can keep their existing import. */
export function useBackTo(target: string) {
  const nav = useNavigate();
  useEffect(() => {
    const tg = getTg();
    const handler = () => {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch {
        /* haptics unsupported on some clients */
      }
      nav(target);
    };
    tg.BackButton.show();
    tg.BackButton.onClick(handler);
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [target, nav]);
}

/** Shared context object passed down to pages. */
export interface PageCtx {
  locale: Locale;
  setLocale: (next: Locale) => Promise<void>;
  picker: PickerState;
  setPicker: (s: PickerState) => void;
  jadval: JadvalState;
  setJadval: (s: JadvalState) => void;
  info: InfoState;
  setInfo: (s: InfoState) => void;
  me: MeResponse | null;
  resetPicker: () => void;
  resetJadval: () => void;
  resetInfo: () => void;
}

/** Helper for pages that need to render a fragment / no-op. */
export const Frag = ({ children }: { children: ReactNode }) => <>{children}</>;
