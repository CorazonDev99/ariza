import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  subtitle?: string;
  /** Small accent label rendered above the title (e.g. a section name). */
  eyebrow?: string;
  children: ReactNode;
}

/**
 * Standard page chrome: large title at the top, optional subtitle,
 * scrollable content area underneath. Mimics the iOS Telegram navigation
 * style — header text is part of the scroll region (no fixed bar) so
 * the user gets all the height for content. The title animates in and
 * the content reveals just after, for a polished, app-like entrance.
 */
export function Page({ title, subtitle, eyebrow, children }: PageProps) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-5 pt-6 pb-3 safe-top">
        {eyebrow && (
          <div className="reveal mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-tg-subtitle">
            {eyebrow}
          </div>
        )}
        <h1
          className="reveal text-[30px] leading-[1.12] font-extrabold tracking-tight text-tg-text"
          style={{ animationDelay: '40ms' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="reveal mt-1.5 text-[15px] leading-snug text-tg-subtitle"
            style={{ animationDelay: '90ms' }}
          >
            {subtitle}
          </p>
        )}
      </header>
      <main
        className="reveal flex-1 px-4 pb-6"
        style={{ animationDelay: '120ms' }}
      >
        {children}
      </main>
    </div>
  );
}
