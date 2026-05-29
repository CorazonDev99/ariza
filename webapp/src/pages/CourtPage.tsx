import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type DistrictCourt } from '../api';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: JadvalState;
  setState: (s: JadvalState) => void;
}

export function CourtPage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/region');

  const [courts, setCourts] = useState<DistrictCourt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.type || !state.region) {
      nav('/');
      return;
    }
    api.courts(state.type, state.region)
      .then(setCourts)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.type, state.region]);

  function pick(courtCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ ...state, court: courtCode, date: null });
    nav('/date');
  }

  return (
    <Page title={t(locale, 'title.courts')}>
      {error && <ErrorBox message={error} />}
      {!courts && !error && <Loader label={t(locale, 'loading')} />}
      {courts && courts.length === 0 && (
        <div className="text-center text-tg-subtitle py-6">—</div>
      )}
      {courts && courts.length > 0 && (
        <List>
          {courts.map((c) => (
            <ListItem
              key={c.code}
              title={c.name[locale]}
              subtitle={c.address?.[locale]}
              onClick={() => pick(c.code)}
            />
          ))}
        </List>
      )}
    </Page>
  );
}
