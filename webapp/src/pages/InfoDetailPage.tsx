import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { t } from '../i18n';
import { api, type CourtInfo } from '../api';
import { useBackTo, type InfoState } from '../App';
import { Page } from '../components/Page';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: InfoState;
}

const TYPE_LABEL_KEY = {
  fuqarolik: 'ci.t.fuqarolik',
  jinoyat: 'ci.t.jinoyat',
  mamuriy: 'ci.t.mamuriy',
  iqtisodiy: 'ci.t.iqtisodiy',
} as const;

function mapLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${address}, Oʻzbekiston`,
  )}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[12px] uppercase tracking-wide text-tg-hint">{label}</div>
      <div className="mt-0.5 text-[15px] text-tg-text break-words">{children}</div>
    </div>
  );
}

export function InfoDetailPage({ locale, state }: Props) {
  const nav = useNavigate();
  useBackTo('/info/court');

  const [court, setCourt] = useState<CourtInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.region || !state.type || !state.court) {
      nav('/info');
      return;
    }
    api.infoCourts(state.region, state.type)
      .then((list) => {
        const found = list.find((c) => c.code === state.court);
        if (found) setCourt(found);
        else nav('/info/court');
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.region, state.type, state.court]);

  return (
    <Page title={t(locale, 'ci.title.courts')}>
      {error && <ErrorBox message={error} />}
      {!court && !error && <Loader label={t(locale, 'loading')} />}
      {court && (
        <>
          <h2 className="px-1 mb-3 text-[20px] font-bold text-tg-text leading-tight">
            🏛 {court.name[locale]}
          </h2>
          <div className="bg-tg-section-bg rounded-2xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            <Row label={t(locale, 'ci.label.type')}>
              {t(
                locale,
                TYPE_LABEL_KEY[court.courtTypeCode as keyof typeof TYPE_LABEL_KEY] ??
                  'ci.label.type',
              )}
            </Row>
            {court.address && (
              <Row label={t(locale, 'ci.label.address')}>{court.address}</Row>
            )}
            {court.phone && (
              <Row label={t(locale, 'ci.label.phone')}>
                <a className="text-tg-link" href={`tel:${court.phone.replace(/[^\d+]/g, '')}`}>
                  {court.phone}
                </a>
              </Row>
            )}
            {court.email && (
              <Row label={t(locale, 'ci.label.email')}>
                <a className="text-tg-link" href={`mailto:${court.email}`}>
                  {court.email}
                </a>
              </Row>
            )}
            <Row label={t(locale, 'ci.label.schedule')}>
              <a className="text-tg-link" href="https://jadval2.sud.uz" target="_blank" rel="noreferrer">
                jadval2.sud.uz
              </a>
            </Row>
          </div>

          {court.address && (
            <a
              href={mapLink(court.address)}
              target="_blank"
              rel="noreferrer"
              className="row-tap mt-3 w-full rounded-2xl p-4 text-center bg-tg-button text-tg-button-text font-semibold block"
            >
              {t(locale, 'ci.map')}
            </a>
          )}
        </>
      )}
    </Page>
  );
}
