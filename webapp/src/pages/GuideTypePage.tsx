import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type CourtType } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

export function GuideTypePage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/');

  const [types, setTypes] = useState<CourtType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.courtTypes().then(setTypes).catch((e) => setError(String(e.message ?? e)));
  }, []);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    ctx.setPicker({ courtType: code, region: null, court: null, template: null });
    nav('/guide/templates');
  }

  return (
    <Page title={t(ctx.locale, 'guide.title')} subtitle={t(ctx.locale, 'guide.pick-type')}>
      {error && <ErrorBox message={error} />}
      {!types && !error && <SkeletonList />}
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
