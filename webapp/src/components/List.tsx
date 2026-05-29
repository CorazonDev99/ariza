import type { ReactNode } from 'react';

interface ListProps {
  children: ReactNode;
}

/** Rounded grouped-list container (iOS-style "inset grouped"). */
export function List({ children }: ListProps) {
  return (
    <div className="bg-tg-section-bg rounded-2xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.08]">
      {children}
    </div>
  );
}

interface ListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function ListItem({ title, subtitle, trailing, onClick, disabled }: ListItemProps) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`row-tap w-full text-left px-4 py-3 flex items-center gap-3 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[16px] leading-snug font-medium text-tg-text break-words">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[13px] text-tg-subtitle break-words">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      {onClick && !trailing && (
        <span className="shrink-0 text-tg-hint text-[18px]" aria-hidden>
          ›
        </span>
      )}
    </Cmp>
  );
}
