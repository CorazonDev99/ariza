import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type Region } from '../api';
import { useBackTo, type InfoState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: InfoState;
  setState: (s: InfoState) => void;
}

export function InfoRegionPage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/info');

  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.type) {
      nav('/info');
      return;
    }
    api.infoRegions(state.type).then(setRegions).catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.type]);

  function pick(regionCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ ...state, region: regionCode, court: null });
    nav('/info/court');
  }

  return (
    <Page title={t(locale, 'ci.title.regions')}>
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
