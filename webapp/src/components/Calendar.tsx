import { useState } from 'react';
import type { Locale } from '../tg';
import { monthNames, t } from '../i18n';
import { getTg } from '../tg';

interface CalendarProps {
  locale: Locale;
  onPick: (dateISO: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Month-view calendar with disabled past dates (mirrors the bot's
 * jcal flow — jadval2 API rejects past dates). The selected day is
 * sent back to the parent as a YYYY-MM-DD string.
 */
export function Calendar({ locale, onPick }: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  const months = monthNames(locale);
  const weekdayLabels = t(locale, 'cal.weekdays').split(' ');

  const total = daysInMonth(year, month);
  // 0=Sun..6=Sat; convert to Monday-first (0=Mon..6=Sun) per UZ/RU convention.
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setMonth(m);
    setYear(y);
    getTg().HapticFeedback.selectionChanged();
  }

  function tap(day: number, isPast: boolean) {
    const tg = getTg();
    if (isPast) {
      tg.HapticFeedback.notificationOccurred('warning');
      tg.showAlert(t(locale, 'cal.past'));
      return;
    }
    tg.HapticFeedback.impactOccurred('medium');
    onPick(`${year}-${pad2(month)}-${pad2(day)}`);
  }

  return (
    <div className="bg-tg-section-bg rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => shift(-1)}
          className="w-9 h-9 grid place-items-center rounded-full row-tap text-tg-link text-xl"
          aria-label="prev"
        >
          ‹
        </button>
        <div className="text-[17px] font-semibold capitalize">
          {months[month - 1]} {year}
        </div>
        <button
          onClick={() => shift(1)}
          className="w-9 h-9 grid place-items-center rounded-full row-tap text-tg-link text-xl"
          aria-label="next"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((w) => (
          <div
            key={w}
            className="h-7 grid place-items-center text-[12px] text-tg-subtitle font-medium"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-10" />;
          const cellDate = new Date(year, month - 1, day);
          cellDate.setHours(0, 0, 0, 0);
          const isPast = cellDate.getTime() < today.getTime();
          const isToday = cellDate.getTime() === today.getTime();
          return (
            <button
              key={i}
              onClick={() => tap(day, isPast)}
              className={
                'h-10 rounded-full text-[15px] font-medium row-tap ' +
                (isPast
                  ? 'text-tg-hint opacity-50'
                  : isToday
                    ? 'bg-tg-link/15 text-tg-link font-semibold'
                    : 'text-tg-text')
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
