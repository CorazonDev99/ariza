import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getTg } from '../tg';
import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { IconCamera, IconImage, IconX } from '../components/icons';

const MAX_SIZE = 1400;
const QUALITY = 0.62;

/** Downscale + re-encode a picked image to keep the upload small. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(drawToJpeg(img, img.width, img.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('img_load'));
    };
    img.src = url;
  });
}

/** Draw a source (image/video) onto a downscaled canvas → JPEG data URL. */
function drawToJpeg(
  src: CanvasImageSource,
  sw: number,
  sh: number,
): string {
  const scale = Math.min(1, MAX_SIZE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('no_ctx');
  c.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

export function ScanPage(ctx: PageCtx) {
  useBackTo('/');
  getTg().MainButton.hide();

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Camera-fallback file input (capture) + gallery input.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attach the live stream once the <video> is mounted.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [cameraOpen]);

  // Stop the camera on unmount.
  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  async function runAnalyze(dataUrl: string) {
    setResult(null);
    setError(false);
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

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    getTg().HapticFeedback.impactOccurred('medium');
    try {
      await runAnalyze(await fileToDataUrl(file));
    } catch {
      setError(true);
    }
  }

  async function openCamera() {
    getTg().HapticFeedback.impactOccurred('medium');
    // True in-app camera via WebRTC — works on desktop (webcam) and mobile.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        setCameraOpen(true);
        return;
      } catch {
        /* denied / unsupported → fall back to the file input below */
      }
    }
    cameraInputRef.current?.click();
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    getTg().HapticFeedback.impactOccurred('heavy');
    let dataUrl: string | null = null;
    try {
      dataUrl = drawToJpeg(v, v.videoWidth, v.videoHeight);
    } catch {
      /* ignore */
    }
    closeCamera();
    if (dataUrl) void runAnalyze(dataUrl);
  }

  function closeCamera() {
    stopStream();
    setCameraOpen(false);
  }

  function openGallery() {
    getTg().HapticFeedback.impactOccurred('light');
    galleryRef.current?.click();
  }

  function reset() {
    getTg().HapticFeedback.impactOccurred('light');
    setPreview(null);
    setResult(null);
    setError(false);
  }

  return (
    <Page
      title={t(ctx.locale, 'scan.title')}
      subtitle={t(ctx.locale, 'scan.subtitle')}
    >
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />

      {/* ── Empty state: camera + gallery ──────────────────────── */}
      {!preview && (
        <div className="reveal">
          <button
            onClick={openCamera}
            className="press w-full rounded-[24px] card card-float p-7 flex flex-col items-center text-center"
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
          <button
            onClick={openGallery}
            className="press mt-3 w-full rounded-2xl py-3.5 card flex items-center justify-center gap-2 text-[15px] font-semibold text-tg-text"
          >
            <IconImage className="w-5 h-5 text-tg-subtitle" />
            {t(ctx.locale, 'scan.gallery')}
          </button>
        </div>
      )}

      {/* ── Result state ───────────────────────────────────────── */}
      {preview && (
        <div className="reveal space-y-3">
          <div className="relative rounded-[20px] overflow-hidden card">
            <img src={preview} alt="" className="w-full max-h-56 object-cover" />
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

      {/* ── Live camera overlay ────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <video
            ref={videoRef}
            playsInline
            muted
            className="flex-1 w-full object-cover"
          />
          <button
            onClick={closeCamera}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 rounded-full grid place-items-center bg-black/50 text-white backdrop-blur"
          >
            <IconX className="w-6 h-6" />
          </button>
          <div className="absolute inset-x-0 bottom-0 pb-8 pt-6 flex items-center justify-center safe-bottom bg-gradient-to-t from-black/70 to-transparent">
            <button
              onClick={shoot}
              aria-label="Shoot"
              className="press w-[74px] h-[74px] rounded-full bg-white grid place-items-center ring-4 ring-white/30 active:scale-95"
            >
              <span className="w-[60px] h-[60px] rounded-full border-[3px] border-black/15" />
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
