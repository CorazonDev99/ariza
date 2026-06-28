import { useEffect, useState } from 'react';
import { getTg } from '../tg';
import type { Locale } from '../tg';
import { t } from '../i18n';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { IconChevron, IconUser, IconUsers } from '../components/icons';

interface LangOpt {
  code: Locale;
  flag: string;
  label: string;
}

const LANGS: LangOpt[] = [
  { code: 'uz_cyrillic', flag: '🇺🇿', label: 'Ўзбекча (кирилл)' },
  { code: 'uz_latin', flag: '🇺🇿', label: "O‘zbekcha (lotin)" },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
];

export function SettingsPage(ctx: PageCtx) {
  useBackTo('/');
  const nav = useNavigate();

  const [subs, setSubs] = useState<number | null>(null);
  useEffect(() => {
    api
      .stats()
      .then((s) => setSubs(s.users))
      .catch(() => undefined);
  }, []);

  async function pick(code: Locale) {
    getTg().HapticFeedback.impactOccurred('medium');
    await ctx.setLocale(code);
  }

  return (
    <Page title={t(ctx.locale, 'settings.title')}>
      {/* «Мои данные» — saved applicant profile */}
      <button
        onClick={() => {
          getTg().HapticFeedback.impactOccurred('light');
          nav('/profile');
        }}
        className="row-tap w-full mb-5 rounded-[20px] card p-4 flex items-center gap-3"
      >
        <div className="shrink-0 w-11 h-11 rounded-2xl brand-bg grid place-items-center text-white ring-accent">
          <IconUser className="w-[22px] h-[22px]" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[15px] font-bold text-tg-text">
            {t(ctx.locale, 'profile.title')}
          </div>
          <div className="text-[12px] text-tg-subtitle mt-0.5">
            {t(ctx.locale, 'profile.menu.sub')}
          </div>
        </div>
        <IconChevron className="shrink-0 w-5 h-5 text-tg-hint" />
      </button>

      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-tg-subtitle px-1 mb-1.5">
        {t(ctx.locale, 'settings.language')}
      </div>
      <div className="card rounded-[20px] overflow-hidden divide-y divide-tg-text/[0.07]">
        {LANGS.map((l) => {
          const active = ctx.locale === l.code;
          return (
            <button
              key={l.code}
              onClick={() => void pick(l.code)}
              className="row-tap w-full px-4 py-3.5 flex items-center gap-3"
            >
              <div className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-[18px] bg-tg-text/[0.05]">
                {l.flag}
              </div>
              <div className="flex-1 text-left text-[16px] font-semibold text-tg-text">
                {l.label}
              </div>
              {active && (
                <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full brand-bg text-tg-button-text text-[13px] font-bold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-tg-subtitle px-1 mt-6 mb-1.5">
        {t(ctx.locale, 'settings.about')}
      </div>
      <div className="card rounded-[20px] p-5">
        <div
          className="text-[14px] leading-relaxed text-tg-text/90"
          dangerouslySetInnerHTML={{ __html: t(ctx.locale, 'settings.about.text') }}
        />
        {subs !== null && (
          <div className="reveal mt-4 pt-4 border-t border-tg-text/[0.07] flex items-center gap-2.5">
            <div className="shrink-0 w-9 h-9 rounded-xl grid place-items-center brand-bg text-white">
              <IconUsers className="w-[18px] h-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="text-[17px] font-extrabold text-tg-text tabular-nums">
                {new Intl.NumberFormat('ru-RU').format(subs)}
              </div>
              <div className="text-[12px] text-tg-subtitle">
                {t(ctx.locale, 'settings.subscribers')}
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
