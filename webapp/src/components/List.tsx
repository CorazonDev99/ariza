import type { ReactNode } from 'react';

interface ListProps {
  children: ReactNode;
  /** Optional small heading above the group (iOS-style section header). */
  header?: string;
}

/** Rounded grouped-list container (iOS-style "inset grouped") with soft
 *  elevation. Children are separated by theme-aware hairlines and reveal
 *  with a gentle stagger. */
export function List({ children, header }: ListProps) {
  return (
    <div>
      {header && (
        <div className="px-4 mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-tg-subtitle">
          {header}
        </div>
      )}
      <div className="card stagger rounded-[20px] overflow-hidden divide-y divide-tg-text/[0.07]">
        {children}
      </div>
    </div>
  );
}

interface ListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional leading element (rendered in a circular accent chip). */
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  disabled,
}: ListItemProps) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`row-tap w-full text-left px-4 py-3.5 flex items-center gap-3 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {leading && (
        <div className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-[18px] bg-accent/12 text-accent">
          {leading}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[16px] leading-snug font-semibold text-tg-text break-words">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[13px] leading-snug text-tg-subtitle break-words">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      {onClick && !trailing && (
        <span
          className="shrink-0 w-6 h-6 -mr-1 grid place-items-center rounded-full text-tg-hint text-[16px] bg-tg-text/[0.04]"
          aria-hidden
        >
          ›
        </span>
      )}
    </Cmp>
  );
}
