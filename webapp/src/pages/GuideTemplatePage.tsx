import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type TemplateSummary } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { SkeletonList, ErrorBox } from '../components/Loader';

export function GuideTemplatePage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/guide');

  const [tpls, setTpls] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.picker.courtType) {
      nav('/guide');
      return;
    }
    api.templates(ctx.picker.courtType)
      .then(setTpls)
      .catch((e) => setError(String(e.message ?? e)));
  }, [ctx.picker.courtType, nav]);

  function pick(code: string) {
    getTg().HapticFeedback.impactOccurred('light');
    ctx.setPicker({ ...ctx.picker, template: code });
    nav('/guide/detail');
  }

  return (
    <Page title={t(ctx.locale, 'guide.title')} subtitle={t(ctx.locale, 'guide.pick-tpl')}>
      {error && <ErrorBox message={error} />}
      {!tpls && !error && <SkeletonList />}
      {tpls && (
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
