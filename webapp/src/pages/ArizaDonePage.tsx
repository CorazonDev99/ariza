import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTg } from '../tg';
import { t } from '../i18n';
import type { GenerateResponse } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';

export function ArizaDonePage(ctx: PageCtx) {
  const nav = useNavigate();
  useBackTo('/');

  const [doc, setDoc] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('ariza:doc');
    if (!raw) {
      nav('/');
      return;
    }
    setDoc(JSON.parse(raw) as GenerateResponse);
    // Clear wizard draft so a "new ariza" tap starts fresh.
    sessionStorage.removeItem('ariza:values');
    sessionStorage.removeItem('ariza:fieldIndex');
  }, [nav]);

  if (!doc) return null;
  const url = doc.downloadUrl;

  return (
    <Page title={t(ctx.locale, 'wiz.done.title')} subtitle={doc.format.toUpperCase()}>
      <div className="bg-tg-section-bg rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">📄</div>
        <div className="text-[15px] text-tg-subtitle">
          {doc.format.toUpperCase()} #{doc.documentId}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <a
          href={url}
          download
          onClick={() => getTg().HapticFeedback.impactOccurred('medium')}
          className="bg-tg-button text-tg-button-text rounded-2xl p-4 font-semibold text-center"
        >
          {t(ctx.locale, 'wiz.done.download')}
        </a>
        <button
          onClick={() => {
            ctx.resetPicker();
            sessionStorage.removeItem('ariza:doc');
            nav('/ariza');
          }}
          className="bg-tg-section-bg text-tg-link rounded-2xl p-3 text-[15px]"
        >
          {t(ctx.locale, 'wiz.done.new')}
        </button>
        <button
          onClick={() => {
            sessionStorage.removeItem('ariza:doc');
            nav('/');
          }}
          className="bg-tg-section-bg rounded-2xl p-3 text-[15px]"
        >
          {t(ctx.locale, 'wiz.done.home')}
        </button>
      </div>
    </Page>
  );
}
