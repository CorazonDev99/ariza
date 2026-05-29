import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type Region } from '../api';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: JadvalState;
  setState: (s: JadvalState) => void;
}

export function RegionPage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/');

  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.type) {
      nav('/');
      return;
    }
    api.regions().then(setRegions).catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.type]);

  function pick(regionCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ ...state, region: regionCode, court: null, date: null });
    nav('/court');
  }

  return (
    <Page title={t(locale, 'title.regions')}>
      {error && <ErrorBox message={error} />}
      {!regions && !error && <Loader label={t(locale, 'loading')} />}
      {regions && (
        <List>
          {regions.map((r) => (
            <ListItem key={r.code} title={r.label[locale]} onClick={() => pick(r.code)} />
          ))}
        </List>
      )}
    </Page>
  );
}
