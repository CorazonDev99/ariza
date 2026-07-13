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
    // Celebrate success with a haptic tap.
    try {
      getTg().HapticFeedback.notificationOccurred('success');
    } catch {
      /* haptics unsupported on some clients */
    }
    // Clear wizard draft so a "new ariza" tap starts fresh.
    sessionStorage.removeItem('ariza:values');
    sessionStorage.removeItem('ariza:fieldIndex');
  }, [nav]);

  if (!doc) return null;
  const url = doc.downloadUrl;

  function download() {
    if (!doc) return;
    const tg = getTg();
    tg.HapticFeedback.impactOccurred('medium');
    // Telegram's webview ignores <a download>; use the native download
    // (Bot API 8.0+ → straight to Downloads) or fall back to opening the
    // link in the browser, which serves the file as an attachment.
    const absUrl = /^https?:\/\//.test(url)
      ? url
      : `${window.location.origin}${url}`;
    const fileName = `ariza-${doc.documentId}.${doc.format}`;
    if (typeof tg.downloadFile === 'function') {
      tg.downloadFile({ url: absUrl, file_name: fileName });
    } else {
      tg.openLink(absUrl);
    }
  }

  return (
    <Page title={t(ctx.locale, 'wiz.done.title')} subtitle={doc.format.toUpperCase()}>
      <div className="card card-float rounded-[22px] p-7 text-center">
        <div className="pop mx-auto mb-4 w-20 h-20 rounded-[24px] grid place-items-center text-[40px] brand-bg ring-accent">
          📄
        </div>
        <div className="text-[17px] font-bold text-tg-text">
          {t(ctx.locale, 'wiz.done.title')}
        </div>
        <div className="text-[13px] text-tg-subtitle mt-1">
          {doc.format.toUpperCase()} · #{doc.documentId}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={download}
          className="bg-tg-button text-tg-button-text rounded-2xl p-4 font-semibold text-center"
        >
          {t(ctx.locale, 'wiz.done.download')}
        </button>
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
