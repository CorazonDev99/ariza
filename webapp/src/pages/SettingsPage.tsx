import { getTg } from '../tg';
import type { Locale } from '../tg';
import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';

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

  async function pick(code: Locale) {
    getTg().HapticFeedback.impactOccurred('medium');
    await ctx.setLocale(code);
  }

  return (
    <Page title={t(ctx.locale, 'settings.title')}>
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
      <div
        className="card rounded-[20px] p-5 text-[14px] leading-relaxed text-tg-text/90"
        dangerouslySetInnerHTML={{ __html: t(ctx.locale, 'settings.about.text') }}
      />
    </Page>
  );
}
