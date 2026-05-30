import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtType } from '../api';
import { useBackTo, type InfoState } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

interface Props {
  locale: Locale;
  state: InfoState;
  setState: (s: InfoState) => void;
}

export function InfoTypePage({ locale, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/');

  const [types, setTypes] = useState<CourtType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.infoTypes().then(setTypes).catch((e) => setError(String(e.message ?? e)));
  }, []);

  function pick(typeCode: string) {
    getTg().HapticFeedback.impactOccurred('light');
    setState({ type: typeCode, region: null, court: null });
    nav('/info/region');
  }

  return (
    <Page title={t(locale, 'ci.title.types')}>
      {error && <ErrorBox message={error} />}
      {!types && !error && <SkeletonList />}
      {types && (
        <List>
          {types.map((c) => (
            <ListItem key={c.code} title={c.label[locale]} onClick={() => pick(c.code)} />
          ))}
        </List>
      )}
    </Page>
  );
}
