import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, isFieldSkipped, type TemplateDetail } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { Loader, ErrorBox } from '../components/Loader';
import { FieldEditor } from '../components/FieldEditor';

const VALUES_KEY = 'ariza:values';
const INDEX_KEY = 'ariza:fieldIndex';

/**
 * Field-collector loop: walks the template's `fields` array sequentially,
 * skipping fields whose skipRule matches the current values. Each
 * committed value is persisted to sessionStorage so a page reload (or
 * Telegram WebView re-mount) doesn't lose progress.
 *
 * When the last field is committed, we jump to /ariza/preview where the
 * user verifies + generates the document.
 */
export function ArizaWizardPage(ctx: PageCtx) {
  const nav = useNavigate();
  const [tpl, setTpl] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const raw = sessionStorage.getItem(VALUES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  });
  const [idx, setIdx] = useState<number>(() => {
    const raw = sessionStorage.getItem(INDEX_KEY);
    return raw ? Number(raw) : 0;
  });

  useEffect(() => {
    sessionStorage.setItem(VALUES_KEY, JSON.stringify(values));
  }, [values]);
  useEffect(() => {
    sessionStorage.setItem(INDEX_KEY, String(idx));
  }, [idx]);

  useEffect(() => {
    if (!ctx.picker.template) {
      nav('/ariza');
      return;
    }
    api.template(ctx.picker.template)
      .then(setTpl)
      .catch((e) => setError(String(e.message ?? e)));
  }, [ctx.picker.template, nav]);

  // BackButton: previous non-skipped field, or back to template picker on
  // the first field.
  useBackTo('/ariza/template');

  /** Build a list of "active" indices — fields that AREN'T skipped given
   *  the current values. Sequential idx points into the full fields[]
   *  array, so we must check skipRule each step. */
  const activeFields = useMemo(() => {
    if (!tpl) return [];
    return tpl.fields
      .map((f, i) => ({ field: f, idx: i }))
      .filter(({ field }) => !isFieldSkipped(field, values));
  }, [tpl, values]);

  if (error) return <ErrorBox message={error} />;
  if (!tpl) return <Loader label={t(ctx.locale, 'loading')} />;

  // Move idx past any skip-able fields. If at end → preview.
  let cur = idx;
  while (cur < tpl.fields.length && isFieldSkipped(tpl.fields[cur]!, values)) {
    cur += 1;
  }
  if (cur >= tpl.fields.length) {
    // All done — drop into preview.
    sessionStorage.setItem(INDEX_KEY, String(cur));
    setTimeout(() => nav('/ariza/preview'), 0);
    return <Loader label={t(ctx.locale, 'loading')} />;
  }

  const field = tpl.fields[cur]!;
  const activePosition =
    activeFields.findIndex((x) => x.idx === cur) + 1;
  const totalActive = activeFields.length || tpl.fields.length;

  function onCommit(value: string) {
    if (!tpl) return;
    const merged: Record<string, string> = { ...values, [field.key]: value };
    // Mirror the bot's splitDate / splitYearMonth logic so generated
    // documents have the same sub-keys to consume.
    if (field.splitDate) {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
      if (m) {
        if (field.splitDate.yearKey) merged[field.splitDate.yearKey] = m[3]!;
        merged[field.splitDate.monthKey] = m[2]!;
        merged[field.splitDate.dayKey] = m[1]!;
      }
    }
    if (field.splitYearMonth) {
      const m = /^(\p{L}+)\s+(\d{4})$/u.exec(value);
      if (m) {
        merged[field.splitYearMonth.monthKey] = m[1]!;
        merged[field.splitYearMonth.yearKey] = m[2]!;
      }
    }
    setValues(merged);
    setIdx(cur + 1);
  }

  const subtitle =
    t(ctx.locale, 'wiz.progress', { cur: activePosition, total: totalActive });

  return (
    <Page title={tpl.title[ctx.locale]} subtitle={subtitle}>
      <ProgressBar current={activePosition} total={totalActive} />
      <div className="mt-4 flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold leading-tight">
          {field.label[ctx.locale]}
        </h2>
        {field.hint && (
          <div className="text-[13px] text-tg-subtitle">
            {t(ctx.locale, 'wiz.field.hint-prefix')}
            {field.hintCopyable ? (
              <code className="text-tg-text">{field.hint[ctx.locale]}</code>
            ) : (
              field.hint[ctx.locale]
            )}
          </div>
        )}
        <FieldEditor
          key={field.key}
          field={field}
          locale={ctx.locale}
          initialValue={values[field.key] ?? ''}
          onCommit={onCommit}
          values={values}
        />
        <button
          onClick={() => {
            if (cur > 0) {
              // Walk back to the previous active field.
              let prev = cur - 1;
              while (prev >= 0 && isFieldSkipped(tpl.fields[prev]!, values)) {
                prev -= 1;
              }
              if (prev >= 0) setIdx(prev);
              else nav('/ariza/template');
            } else {
              nav('/ariza/template');
            }
            getTg().HapticFeedback.impactOccurred('light');
          }}
          className="text-tg-link p-2 text-[14px]"
        >
          {t(ctx.locale, 'btn.back')}
        </button>
      </div>
    </Page>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div className="h-1 w-full bg-tg-section-bg rounded-full overflow-hidden">
      <div
        className="h-full bg-tg-link transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
