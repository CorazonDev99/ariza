import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtType } from '../api';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  setState: (s: JadvalState) => void;
}

/** Shown after picking «Жиноят» in the schedule flow: criminal cases
 *  (jib/jib) vs administrative offences (jib/mhb). */
export function JadvalSubPage({ locale, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/jadval');

  const [cats, setCats] = useState<CourtType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scheduleCategories().then(setCats).catch((e) => setError(String(e.message ?? e)));
  }, []);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ type: code, region: null, court: null, date: null });
    nav('/jadval/region');
  }

  return (
    <Page title={t(locale, 'title.jadval')} subtitle={t(locale, 'jadval.sub.title')}>
      {error && <ErrorBox message={error} onRetry={() => {
        setError(null);
        api.scheduleCategories().then(setCats).catch((e) => setError(String(e.message ?? e)));
      }} />}
      {!cats && !error && <SkeletonList rows={2} />}
      {cats && (
        <List>
          {cats.map((c) => (
            <ListItem
              key={c.code}
              leading="⚖️"
              title={c.label[locale]}
              onClick={() => pick(c.code)}
            />
          ))}
        </List>
      )}
    </Page>
  );
}
