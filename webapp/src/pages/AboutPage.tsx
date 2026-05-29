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
    <div className="bg-tg-section-bg rounded-2xl p-4">
      <div className="text-[15px] font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}
