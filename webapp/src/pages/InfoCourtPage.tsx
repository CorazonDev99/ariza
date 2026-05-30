import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtInfo } from '../api';
import { useBackTo, type InfoState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: InfoState;
  setState: (s: InfoState) => void;
}

export function InfoCourtPage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/info/region');

  const [courts, setCourts] = useState<CourtInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.region || !state.type) {
      nav('/info');
      return;
    }
    api.infoCourts(state.region, state.type)
      .then(setCourts)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.region, state.type]);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ ...state, court: code });
    nav('/info/detail');
  }

  return (
    <Page title={t(locale, 'ci.title.courts')}>
      {error && <ErrorBox message={error} />}
      {!courts && !error && <SkeletonList />}
      {courts && (
        <List>
          {courts.map((c) => (
            <ListItem
              key={c.code}
              title={c.name[locale]}
              subtitle={c.address}
              onClick={() => pick(c.code)}
            />
          ))}
        </List>
      )}
    </Page>
  );
}
