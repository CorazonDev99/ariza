import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type TemplateSummary } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

export function ArizaTemplatePage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/ariza/court');

  const [tpls, setTpls] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.picker.courtType || !ctx.picker.region || !ctx.picker.court) {
      nav('/ariza');
      return;
    }
    api.templates(ctx.picker.courtType)
      .then(setTpls)
      .catch((e) => setError(String(e.message ?? e)));
  }, [nav, ctx.picker.courtType, ctx.picker.region, ctx.picker.court]);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    // Wipe any previous draft values stored under the previous template.
    sessionStorage.removeItem('ariza:values');
    sessionStorage.removeItem('ariza:fieldIndex');
    ctx.setPicker({ ...ctx.picker, template: code });
    nav('/ariza/wizard');
  }

  return (
    <Page title={t(ctx.locale, 'wiz.pick-template')}>
      {error && <ErrorBox message={error} />}
      {!tpls && !error && <SkeletonList />}
      {tpls && tpls.length === 0 && (
        <div className="text-center py-10 text-tg-subtitle">—</div>
      )}
      {tpls && tpls.length > 0 && (
        <List>
          {tpls.map((tpl) => (
            <ListItem
              key={tpl.code}
              title={tpl.title[ctx.locale]}
              subtitle={tpl.subtitle[ctx.locale]}
              onClick={() => pick(tpl.code)}
            />
          ))}
        </List>
      )}
    </Page>
  );
}
