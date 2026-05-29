import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CaseEntry, type ScheduleResponse } from '../api';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: JadvalState;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** "<b>X</b>" → React nodes — minimal HTML support for our i18n strings. */
function renderBold(template: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = /<b>(.*?)<\/b>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (m.index > last) parts.push(template.slice(last, m.index));
    parts.push(<b key={key++}>{m[1]}</b>);
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

export function SchedulePage({ locale, state }: Props) {
  const nav = useNavigate();
  useBackTo('/jadval/date');

  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!state.type || !state.court || !state.date) {
      nav('/jadval');
      return;
    }
    setError(null);
    setData(null);
    api.schedule(state.type, state.court, state.date)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.type, state.court, state.date]);

  const filtered = useMemo<CaseEntry[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.entries;
    return data.entries.filter((e) =>
      [e.party1, e.party2, e.caseNumber, e.judge, e.category]
        .filter((x): x is string => !!x)
        .some((s) => s.toLowerCase().includes(q)),
    );
  }, [data, query]);

  const courtName = data?.court.name[locale] ?? '';
  const dateStr = state.date ? formatDate(state.date) : '';
  const isCriminal = state.type === 'jinoyat';

  return (
    <Page title={courtName} subtitle={dateStr}>
      {error && <ErrorBox message={t(locale, 'error.api')} onRetry={() => {
        if (!state.type || !state.court || !state.date) return;
        setError(null);
        setData(null);
        api.schedule(state.type, state.court, state.date)
          .then(setData)
          .catch((e) => setError(String(e.message ?? e)));
      }} />}
      {!data && !error && <Loader label={t(locale, 'loading')} />}
      {data && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(locale, 'search.placeholder')}
                className="w-full bg-tg-section-bg rounded-xl px-4 py-2.5 text-[15px] outline-none placeholder:text-tg-hint"
                inputMode="search"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    getTg().HapticFeedback.impactOccurred('light');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-tg-hint"
                  aria-label="clear"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => nav('/jadval/date')}
              className="bg-tg-section-bg rounded-xl px-3 py-2.5 text-[14px] text-tg-link"
            >
              📅
            </button>
          </div>

          <div className="mb-3 text-[13px] text-tg-subtitle">
            {query
              ? renderBold(
                  t(locale, 'schedule.matched', { m: filtered.length, n: data.total }),
                )
              : renderBold(t(locale, 'schedule.total', { n: data.total }))}
          </div>

          {data.total === 0 && (
            <div className="text-center py-10 text-tg-subtitle">
              {t(locale, 'schedule.empty')}
            </div>
          )}
          {data.total > 0 && filtered.length === 0 && (
            <div className="text-center py-10 text-tg-subtitle">
              {t(locale, 'schedule.search-empty')}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map((e, i) => (
              <EntryCard
                key={`${e.caseNumber}-${i}`}
                locale={locale}
                entry={e}
                criminal={isCriminal}
              />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

function EntryCard({
  entry,
  locale,
  criminal,
}: {
  entry: CaseEntry;
  locale: Locale;
  criminal: boolean;
}) {
  return (
    <div className="bg-tg-section-bg rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[17px] font-semibold text-tg-link">{entry.time}</div>
        <div className="text-[12px] text-tg-subtitle text-right max-w-[60%] break-words">
          {entry.instance}
        </div>
      </div>
      <div className="text-[13px] text-tg-subtitle font-mono mb-2 break-all">
        {entry.caseNumber}
      </div>
      {entry.category && (
        <div className="text-[13px] text-tg-text/80 mb-2 italic break-words">
          {entry.category}
        </div>
      )}
      <div className="space-y-1">
        <FieldRow
          label={criminal ? t(locale, 'fields.accused') : t(locale, 'fields.claimant')}
          value={entry.party1}
        />
        <FieldRow
          label={criminal ? t(locale, 'fields.victim') : t(locale, 'fields.defendant')}
          value={entry.party2}
        />
        <FieldRow label={t(locale, 'fields.judge')} value={entry.judge} />
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex gap-2 text-[14px]">
      <div className="text-tg-subtitle shrink-0 min-w-[80px]">{label}:</div>
      <div className="text-tg-text break-words flex-1 whitespace-pre-line">{value}</div>
    </div>
  );
}
