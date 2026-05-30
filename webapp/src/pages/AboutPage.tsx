import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';

export function AboutPage(ctx: PageCtx) {
  useBackTo('/');

  return (
    <Page title={t(ctx.locale, 'about.title')} subtitle={t(ctx.locale, 'about.tagline')}>
      <div className="flex flex-col gap-3">
        <Section title={t(ctx.locale, 'about.what.title')}>
          <div className="text-[14px] whitespace-pre-line leading-relaxed">
            {t(ctx.locale, 'about.what.text')}
          </div>
        </Section>

        <Section title={t(ctx.locale, 'about.types.title')}>
          <div className="text-[14px] whitespace-pre-line leading-relaxed">
            {t(ctx.locale, 'about.types.list')}
          </div>
        </Section>

        <Section title={t(ctx.locale, 'about.courts.title')}>
          <div
            className="text-[14px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: t(ctx.locale, 'about.courts.text') }}
          />
        </Section>

        <Section title={t(ctx.locale, 'about.privacy.title')}>
          <div className="text-[14px] leading-relaxed">
            {t(ctx.locale, 'about.privacy.text')}
          </div>
        </Section>

        <Section title={t(ctx.locale, 'about.source.title')}>
          <a
            href={`https://${t(ctx.locale, 'about.source.link')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tg-link text-[14px] break-all"
          >
            {t(ctx.locale, 'about.source.link')}
          </a>
        </Section>
      </div>
    </Page>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card rounded-[20px] p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-1.5 h-4 rounded-full brand-bg" />
        <div className="text-[15px] font-bold text-tg-text">{title}</div>
      </div>
      <div className="text-tg-text/90">{children}</div>
    </div>
  );
}
