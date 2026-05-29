import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, isFieldSkipped, type TemplateDetail } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { Loader, ErrorBox } from '../components/Loader';

export function ArizaPreviewPage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/ariza/wizard');

  const [tpl, setTpl] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');

  const values = JSON.parse(sessionStorage.getItem('ariza:values') ?? '{}') as Record<string, string>;

  useEffect(() => {
    if (!ctx.picker.template) {
      nav('/ariza');
      return;
    }
    api.template(ctx.picker.template).then(setTpl).catch((e) => setError(String(e.message ?? e)));
  }, [ctx.picker.template, nav]);

  async function generate() {
    if (!tpl || !ctx.picker.template) return;
    setGenerating(true);
    try {
      const res = await api.generate({
        templateCode: ctx.picker.template,
        courtTypeCode: ctx.picker.courtType ?? undefined,
        regionCode: ctx.picker.region ?? undefined,
        districtCourtCode: ctx.picker.court ?? undefined,
        values,
        format,
        locale: ctx.locale,
      });
      sessionStorage.setItem('ariza:doc', JSON.stringify(res));
      getTg().HapticFeedback.notificationOccurred('success');
      nav('/ariza/done');
    } catch (e) {
      getTg().HapticFeedback.notificationOccurred('error');
      setError(String((e as Error).message));
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!tpl) return <Loader label={t(ctx.locale, 'loading')} />;

  // Render only the visible (non-skipped, non-split-derived) fields.
  const visible = tpl.fields.filter((f) => !isFieldSkipped(f, values));

  return (
    <Page title={t(ctx.locale, 'wiz.preview.title')} subtitle={tpl.title[ctx.locale]}>
      <div className="bg-tg-section-bg rounded-2xl divide-y divide-black/[0.06] dark:divide-white/[0.08]">
        {visible.map((f) => (
          <div key={f.key} className="px-4 py-3">
            <div className="text-[12px] text-tg-subtitle">{f.label[ctx.locale]}</div>
            <div className="text-[15px] text-tg-text mt-1 whitespace-pre-line break-words">
              {values[f.key] || '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <FormatBtn label="PDF" on={format === 'pdf'} onClick={() => setFormat('pdf')} />
        <FormatBtn label="DOCX" on={format === 'docx'} onClick={() => setFormat('docx')} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={() => void generate()}
          disabled={generating}
          className="bg-tg-button text-tg-button-text rounded-2xl p-4 font-semibold disabled:opacity-50"
        >
          {generating ? t(ctx.locale, 'wiz.generate.processing') : t(ctx.locale, 'btn.generate')}
        </button>
        <button
          onClick={() => nav('/ariza/wizard')}
          className="bg-tg-section-bg text-tg-link rounded-2xl p-3 text-[14px]"
        >
          {t(ctx.locale, 'btn.edit')}
        </button>
      </div>
    </Page>
  );
}

function FormatBtn({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-1 rounded-2xl p-3 text-[15px] font-medium ' +
        (on ? 'bg-tg-link/15 text-tg-link' : 'bg-tg-section-bg text-tg-text')
      }
    >
      {label}
    </button>
  );
}
