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
      <div className="text-[13px] text-tg-subtitle px-1 mb-2">
        {t(ctx.locale, 'settings.language')}
      </div>
      <div className="bg-tg-section-bg rounded-2xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.08]">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => void pick(l.code)}
            className="row-tap w-full px-4 py-3 flex items-center gap-3"
          >
            <div className="text-xl">{l.flag}</div>
            <div className="flex-1 text-left text-[16px]">{l.label}</div>
            {ctx.locale === l.code && <div className="text-tg-link">✓</div>}
          </button>
        ))}
      </div>

      <div className="text-[13px] text-tg-subtitle px-1 mt-6 mb-2">
        {t(ctx.locale, 'settings.about')}
      </div>
      <div
        className="bg-tg-section-bg rounded-2xl p-4 text-[14px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: t(ctx.locale, 'settings.about.text') }}
      />
    </Page>
  );
}
