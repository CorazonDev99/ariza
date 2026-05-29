import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type Region } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

export function ArizaRegionPage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/ariza');

  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.picker.courtType) {
      nav('/ariza');
      return;
    }
    api.regions()
      .then(setRegions)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, ctx.picker.courtType]);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    ctx.setPicker({ ...ctx.picker, region: code, court: null, template: null });
    nav('/ariza/court');
  }

  return (
    <Page title={t(ctx.locale, 'wiz.pick-region')}>
      {error && <ErrorBox message={error} />}
      {!regions && !error && <Loader label={t(ctx.locale, 'loading')} />}
      {regions && (
        <List>
          {regions.map((r) => (
            <ListItem key={r.code} title={r.label[ctx.locale]} onClick={() => pick(r.code)} />
          ))}
        </List>
      )}
    </Page>
  );
}
