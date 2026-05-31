import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import type { PageCtx } from '../App';

interface Tile {
  icon: string;
  title: string;
  sub: string;
  to: string;
  /** Accent color used for the icon chip + ambient glow. */
  color: string;
}

export function HomePage(ctx: PageCtx) {
  const nav = useNavigate();

  getTg().BackButton.hide();
  getTg().MainButton.hide();

  const tiles: Tile[] = [
    {
      icon: '📄',
      title: t(ctx.locale, 'home.action.new'),
      sub: t(ctx.locale, 'home.action.new.sub'),
      to: '/ariza',
      color: '#3b82f6',
    },
    {
      icon: '📋',
      title: t(ctx.locale, 'home.action.jadval'),
      sub: t(ctx.locale, 'home.action.jadval.sub'),
      to: '/jadval',
      color: '#10b981',
    },
    {
      icon: '📖',
      title: t(ctx.locale, 'home.action.guide'),
      sub: t(ctx.locale, 'home.action.guide.sub'),
      to: '/guide',
      color: '#f59e0b',
    },
    {
      icon: '🏛',
      title: t(ctx.locale, 'home.action.courtinfo'),
      sub: t(ctx.locale, 'home.action.courtinfo.sub'),
      to: '/info',
      color: '#0ea5e9',
    },
  ];

  function go(to: string) {
    getTg().HapticFeedback.impactOccurred('light');
    if (to === '/ariza') ctx.resetPicker();
    if (to === '/jadval') ctx.resetJadval();
    if (to === '/info') ctx.resetInfo();
    nav(to);
  }

  return (
    <div className="flex flex-col min-h-full px-4 pt-6 safe-top safe-bottom">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <header className="flex items-center gap-3.5 px-1 mb-5">
        <div
          className="pop relative shrink-0 w-14 h-14 rounded-[18px] brand-bg grid place-items-center text-[26px] ring-accent"
          style={{ animationDelay: '20ms' }}
        >
          ⚖️
        </div>
        <div>
          <h1
            className="reveal text-[26px] leading-none font-extrabold tracking-tight brand-text"
            style={{ animationDelay: '60ms' }}
          >
            {t(ctx.locale, 'home.title')}
          </h1>
          <p
            className="reveal mt-1.5 text-[13px] leading-snug text-tg-subtitle"
            style={{ animationDelay: '110ms' }}
          >
            {t(ctx.locale, 'home.subtitle')}
          </p>
        </div>
      </header>

      {/* ── Action tiles ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tl, i) => (
          <button
            key={tl.to}
            onClick={() => go(tl.to)}
            className="press reveal relative overflow-hidden rounded-[22px] p-4 text-left card min-h-[128px] flex flex-col justify-between"
            style={{ animationDelay: `${140 + i * 55}ms` }}
          >
            {/* ambient corner glow in the tile's accent color */}
            <div
              className="pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl"
              style={{ background: tl.color, opacity: 0.18 }}
            />
            <div
              className="relative w-12 h-12 rounded-2xl grid place-items-center text-[24px]"
              style={{ background: `color-mix(in srgb, ${tl.color} 16%, transparent)` }}
            >
              {tl.icon}
            </div>
            <div className="relative">
              <div className="text-[15px] font-bold text-tg-text leading-tight">
                {tl.title}
              </div>
              <div className="text-[12px] text-tg-subtitle mt-1 leading-snug">
                {tl.sub}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Settings ───────────────────────────────────────────── */}
      <button
        onClick={() => {
          getTg().HapticFeedback.impactOccurred('light');
          nav('/settings');
        }}
        className="press reveal mt-3 w-full rounded-[22px] p-4 text-left card flex items-center gap-3"
        style={{ animationDelay: `${140 + tiles.length * 55}ms` }}
      >
        <div className="shrink-0 w-11 h-11 rounded-2xl grid place-items-center text-[22px] bg-tg-text/[0.05]">
          ⚙️
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-tg-text">
            {t(ctx.locale, 'home.action.settings')}
          </div>
          <div className="text-[12px] text-tg-subtitle mt-0.5">
            {t(ctx.locale, 'home.action.settings.sub')}
          </div>
        </div>
        <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full text-tg-hint text-[16px] bg-tg-text/[0.04]">
          ›
        </span>
      </button>

      <div className="flex-1" />
      <div
        className="reveal text-center text-[11px] text-tg-hint/70 pt-6 pb-2"
        style={{ animationDelay: '460ms' }}
      >
        ⚖️ Adolat · Oʻzbekiston sudlari
      </div>
    </div>
  );
}
