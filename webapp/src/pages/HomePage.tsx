import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { getTg } from '../tg';
import { t } from '../i18n';
import type { PageCtx } from '../App';

interface Tile {
  icon: string;
  title: string;
  sub: string;
  to: string;
  bg: string;
}

export function HomePage(ctx: PageCtx) {
  const nav = useNavigate();

  // Hide BackButton on root.
  getTg().BackButton.hide();
  getTg().MainButton.hide();

  const tiles: Tile[] = [
    {
      icon: '📄',
      title: t(ctx.locale, 'home.action.new'),
      sub: t(ctx.locale, 'home.action.new.sub'),
      to: '/ariza',
      bg: 'from-blue-500/15 to-blue-500/5',
    },
    {
      icon: '📋',
      title: t(ctx.locale, 'home.action.jadval'),
      sub: t(ctx.locale, 'home.action.jadval.sub'),
      to: '/jadval',
      bg: 'from-emerald-500/15 to-emerald-500/5',
    },
    {
      icon: '📖',
      title: t(ctx.locale, 'home.action.guide'),
      sub: t(ctx.locale, 'home.action.guide.sub'),
      to: '/guide',
      bg: 'from-amber-500/15 to-amber-500/5',
    },
    {
      icon: '🏛',
      title: t(ctx.locale, 'home.action.courtinfo'),
      sub: t(ctx.locale, 'home.action.courtinfo.sub'),
      to: '/info',
      bg: 'from-sky-500/15 to-sky-500/5',
    },
    {
      icon: 'ℹ️',
      title: t(ctx.locale, 'home.action.about'),
      sub: t(ctx.locale, 'home.action.about.sub'),
      to: '/about',
      bg: 'from-purple-500/15 to-purple-500/5',
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
    <Page title={t(ctx.locale, 'home.title')} subtitle={t(ctx.locale, 'home.subtitle')}>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tl) => (
          <button
            key={tl.to}
            onClick={() => go(tl.to)}
            className={
              'row-tap rounded-2xl p-4 text-left bg-gradient-to-br ' +
              tl.bg +
              ' bg-tg-section-bg min-h-[120px] flex flex-col justify-between'
            }
          >
            <div className="text-3xl">{tl.icon}</div>
            <div>
              <div className="text-[15px] font-semibold text-tg-text leading-tight">
                {tl.title}
              </div>
              <div className="text-[12px] text-tg-subtitle mt-1 leading-tight">{tl.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          getTg().HapticFeedback.impactOccurred('light');
          nav('/settings');
        }}
        className="row-tap mt-3 w-full rounded-2xl p-4 text-left bg-tg-section-bg flex items-center gap-3"
      >
        <div className="text-2xl">⚙️</div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-tg-text">
            {t(ctx.locale, 'home.action.settings')}
          </div>
          <div className="text-[12px] text-tg-subtitle">
            {t(ctx.locale, 'home.action.settings.sub')}
          </div>
        </div>
        <span className="text-tg-hint text-xl">›</span>
      </button>
    </Page>
  );
}
