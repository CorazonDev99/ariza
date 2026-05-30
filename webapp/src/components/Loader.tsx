interface LoaderProps {
  label?: string;
}

export function Loader({ label }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3.5">
      <div className="relative w-10 h-10">
        {/* track */}
        <div className="absolute inset-0 rounded-full border-[3px] border-tg-text/10" />
        {/* spinning accent arc */}
        <div className="tg-spinner absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent border-r-accent/40" />
      </div>
      {label && (
        <div className="text-[14px] font-medium text-tg-subtitle">{label}</div>
      )}
    </div>
  );
}

/** Shimmer placeholder rows — use while a list is loading for a calmer,
 *  more premium feel than a bare spinner. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card rounded-[20px] overflow-hidden divide-y divide-tg-text/[0.07]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-3">
          <div className="skeleton w-9 h-9 !rounded-full shrink-0" />
          <div className="flex-1">
            <div className="skeleton h-3.5" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
            <div className="skeleton h-2.5 mt-2" style={{ width: `${30 + ((i * 7) % 25)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline error block (use when network call fails). Always offers a
 *  "Home" escape hatch — Telegram's BackButton can disappear unexpectedly
 *  in some clients and users get stranded otherwise. */
export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card rounded-[20px] p-6 text-center">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center text-[22px] bg-tg-destructive/10">
        ⚠️
      </div>
      <div className="text-tg-text text-[15px] leading-snug break-words">{message}</div>
      <div className="mt-4 flex flex-col gap-2.5">
        {onRetry && (
          <button
            onClick={onRetry}
            className="press brand-bg text-tg-button-text text-[15px] font-semibold rounded-2xl py-3 ring-accent"
          >
            Қайта уриниш / Повторить
          </button>
        )}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = '';
            window.location.reload();
          }}
          className="text-tg-link text-[14px] font-medium py-1"
        >
          🏠 Бошга / На главную
        </a>
      </div>
    </div>
  );
}
