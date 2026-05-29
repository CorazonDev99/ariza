import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtType } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

export function ArizaTypePage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/');

  const [types, setTypes] = useState<CourtType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.courtTypes()
      .then(setTypes)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    ctx.setPicker({ courtType: code, region: null, court: null, template: null });
    nav('/ariza/region');
  }

  return (
    <Page title={t(ctx.locale, 'home.action.new')} subtitle={t(ctx.locale, 'wiz.pick-court-type')}>
      {error && <ErrorBox message={error} />}
      {!types && !error && <Loader label={t(ctx.locale, 'loading')} />}
      {types && (
        <List>
          {types.map((c) => (
            <ListItem key={c.code} title={c.label[ctx.locale]} onClick={() => pick(c.code)} />
          ))}
        </List>
      )}
    </Page>
  );
}
