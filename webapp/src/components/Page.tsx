import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Standard page chrome: large title at the top, optional subtitle,
 * scrollable content area underneath. Mimics the iOS Telegram navigation
 * style — header text is part of the scroll region (no fixed bar) so
 * the user gets all the height for content.
 */
export function Page({ title, subtitle, children }: PageProps) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-5 pt-5 pb-3 safe-top">
        <h1 className="text-[28px] leading-tight font-bold text-tg-text">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[15px] text-tg-subtitle">{subtitle}</p>
        )}
      </header>
      <main className="flex-1 px-4 pb-4">{children}</main>
    </div>
  );
}
