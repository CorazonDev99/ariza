import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type TemplateDetail } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { Loader, ErrorBox } from '../components/Loader';

export function GuideDetailPage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/guide/templates');

  const [tpl, setTpl] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.picker.template) {
      nav('/guide');
      return;
    }
    api.template(ctx.picker.template).then(setTpl).catch((e) => setError(String(e.message ?? e)));
  }, [ctx.picker.template, nav]);

  if (error) return <ErrorBox message={error} />;
  if (!tpl) return <Loader label={t(ctx.locale, 'loading')} />;

  function startFilling() {
    getTg().HapticFeedback.impactOccurred('medium');
    // The user already picked a template; jump to the court-type step
    // of the ariza wizard. They'll re-pick region/court there.
    ctx.setPicker({
      courtType: tpl!.courtTypeCode,
      region: null,
      court: null,
      template: tpl!.code,
    });
    sessionStorage.removeItem('ariza:values');
    sessionStorage.removeItem('ariza:fieldIndex');
    nav('/ariza/region');
  }

  return (
    <Page title={tpl.title[ctx.locale]} subtitle={tpl.subtitle[ctx.locale]}>
      <div
        className="card rounded-[20px] p-5 text-[14px] leading-relaxed whitespace-pre-line text-tg-text/90"
        dangerouslySetInnerHTML={{ __html: tpl.instructions[ctx.locale] }}
      />
      <button
        onClick={startFilling}
        className="mt-4 w-full bg-tg-button text-tg-button-text rounded-2xl p-4 font-semibold"
      >
        {t(ctx.locale, 'guide.start-filling')}
      </button>
    </Page>
  );
}
