interface LoaderProps {
  label?: string;
}

export function Loader({ label }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="tg-spinner w-7 h-7 rounded-full border-[3px] border-tg-hint/30 border-t-tg-link" />
      {label && <div className="text-[14px] text-tg-subtitle">{label}</div>}
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
    <div className="bg-tg-section-bg rounded-2xl p-5 text-center">
      <div className="text-tg-destructive text-[15px] break-words">{message}</div>
      <div className="mt-3 flex flex-col gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-tg-link text-[15px] font-medium"
          >
            Қайта уриниш / Повторить
          </button>
        )}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = '';
            // Force-rerender the App at the root URL.
            window.location.reload();
          }}
          className="text-tg-link text-[14px]"
        >
          🏠 Бошга / На главную
        </a>
      </div>
    </div>
  );
}
