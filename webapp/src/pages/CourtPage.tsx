import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type DistrictCourt } from '../api';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: JadvalState;
  setState: (s: JadvalState) => void;
}

export function CourtPage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/jadval/region');

  const [courts, setCourts] = useState<DistrictCourt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.type || !state.region) {
      nav('/jadval');
      return;
    }
    api.courts(state.type, state.region)
      .then(setCourts)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, state.type, state.region]);

  function pick(courtCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ ...state, court: courtCode, date: null });
    nav('/jadval/date');
  }

  return (
    <Page title={t(locale, 'title.courts')}>
      {error && <ErrorBox message={error} />}
      {!courts && !error && <SkeletonList />}
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
