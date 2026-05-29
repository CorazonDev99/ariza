import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtType } from '../api';
import type { JadvalState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  setState: (s: JadvalState) => void;
}

export function TypePage({ locale, setState }: Props) {
  const nav = useNavigate();
  const [types, setTypes] = useState<CourtType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hide BackButton on root — there's nowhere to go back to from here.
    getTg().BackButton.hide();
  }, []);

  useEffect(() => {
    api.courtTypes().then(setTypes).catch((e) => setError(String(e.message ?? e)));
  }, []);

  function pick(typeCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ type: typeCode, region: null, court: null, date: null });
    nav('/region');
  }

  return (
    <Page title={t(locale, 'title.jadval')} subtitle={t(locale, 'title.types')}>
      {error && <ErrorBox message={error} onRetry={() => {
        setError(null);
        api.courtTypes().then(setTypes).catch((e) => setError(String(e.message ?? e)));
      }} />}
      {!types && !error && <Loader label={t(locale, 'loading')} />}
      {types && (
        <List>
          {types.map((ct) => (
            <ListItem key={ct.code} title={ct.label[locale]} onClick={() => pick(ct.code)} />
          ))}
        </List>
      )}
    </Page>
  );
}
