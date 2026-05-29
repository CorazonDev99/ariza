import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type DistrictCourt } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

export function ArizaCourtPage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/ariza/region');

  const [courts, setCourts] = useState<DistrictCourt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.picker.courtType || !ctx.picker.region) {
      nav('/ariza');
      return;
    }
    api.courts(ctx.picker.courtType, ctx.picker.region)
      .then(setCourts)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, ctx.picker.courtType, ctx.picker.region]);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    ctx.setPicker({ ...ctx.picker, court: code, template: null });
    nav('/ariza/template');
  }

  return (
    <Page title={t(ctx.locale, 'wiz.pick-court')}>
      {error && <ErrorBox message={error} />}
      {!courts && !error && <Loader label={t(ctx.locale, 'loading')} />}
      {courts && (
        <List>
          {courts.map((c) => (
            <ListItem
              key={c.code}
              title={c.name[ctx.locale]}
              subtitle={c.address?.[ctx.locale]}
              onClick={() => pick(c.code)}
            />
          ))}
        </List>
      )}
    </Page>
  );
}
