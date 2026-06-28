import { useRef, useState } from 'react';
import { api } from '../api';
import { getTg } from '../tg';
import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { IconCamera } from '../components/icons';

/** Downscale + re-encode a picked image to keep the upload small and fast. */
function fileToDataUrl(file: File, maxSize = 1400, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext('2d');
      if (!c) return reject(new Error('no_ctx'));
      c.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('img_load'));
    };
    img.src = url;
  });
}

export function ScanPage(ctx: PageCtx) {
  useBackTo('/');
  getTg().MainButton.hide();

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    getTg().HapticFeedback.impactOccurred('medium');
    setResult(null);
    setError(false);
    let dataUrl: string;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      setError(true);
      return;
    }
    setPreview(dataUrl);
    setBusy(true);
    try {
      const { analysis } = await api.scan(dataUrl, ctx.locale);
      setResult(analysis);
      getTg().HapticFeedback.notificationOccurred('success');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    getTg().HapticFeedback.impactOccurred('light');
    setPreview(null);
    setResult(null);
    setError(false);
    inputRef.current?.click();
  }

  return (
    <Page
      title={t(ctx.locale, 'scan.title')}
      subtitle={t(ctx.locale, 'scan.subtitle')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />

      {/* ── Empty state: big tappable capture card ─────────────── */}
      {!preview && (
        <button
          onClick={() => {
            getTg().HapticFeedback.impactOccurred('medium');
            inputRef.current?.click();
          }}
          className="press reveal w-full rounded-[24px] card card-float p-7 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-3xl brand-bg grid place-items-center text-white ring-accent">
            <IconCamera className="w-10 h-10" />
          </div>
          <div className="mt-4 text-[17px] font-bold text-tg-text">
            {t(ctx.locale, 'scan.cta')}
          </div>
          <div className="mt-1.5 text-[13px] leading-snug text-tg-subtitle max-w-[280px]">
            {t(ctx.locale, 'scan.hint')}
          </div>
        </button>
      )}

      {/* ── Result state: preview + analysis ───────────────────── */}
      {preview && (
        <div className="reveal space-y-3">
          <div className="relative rounded-[20px] overflow-hidden card">
            <img
              src={preview}
              alt=""
              className="w-full max-h-56 object-cover"
            />
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-tg-bg/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ animationDelay: '160ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '320ms' }} />
                  </div>
                  <span className="text-[13px] font-medium text-tg-subtitle">
                    {t(ctx.locale, 'scan.thinking')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="card rounded-[20px] p-4">
              <p className="text-[14px] leading-relaxed text-tg-text whitespace-pre-wrap">
                {result}
              </p>
              <p className="mt-3 pt-3 border-t border-tg-text/[0.07] text-[11px] leading-snug text-tg-hint/80">
                {t(ctx.locale, 'scan.disclaimer')}
              </p>
            </div>
          )}

          {error && (
            <div className="card rounded-[20px] p-4 text-[14px] leading-relaxed text-tg-destructive">
              {t(ctx.locale, 'scan.error')}
            </div>
          )}

          {!busy && (
            <button
              onClick={reset}
              className="press w-full rounded-2xl py-3.5 brand-bg text-white font-semibold text-[15px] ring-accent flex items-center justify-center gap-2"
            >
              <IconCamera className="w-5 h-5" />
              {t(ctx.locale, 'scan.again')}
            </button>
          )}
        </div>
      )}
    </Page>
  );
}
