import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../tg';
import { t } from '../i18n';
import { useBackTo, type JadvalState } from '../App';
import { Page } from '../components/Page';
import { Calendar } from '../components/Calendar';

interface Props {
  locale: Locale;
  state: JadvalState;
  setState: (s: JadvalState) => void;
}

export function DatePage({ locale, state, setState }: Props) {
  const nav = useNavigate();
  useBackTo('/court');

  useEffect(() => {
    if (!state.type || !state.region || !state.court) nav('/');
  }, [nav, state.type, state.region, state.court]);

  function pick(dateISO: string) {
    setState({ ...state, date: dateISO });
    nav('/schedule');
  }

  return (
    <Page title={t(locale, 'title.date')}>
      <Calendar locale={locale} onPick={pick} />
    </Page>
  );
}
