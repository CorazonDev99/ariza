import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { type Locale, t } from '../i18n';

export type ValidatorKind =
  | 'text'
  | 'fio'
  | 'phone'
  | 'money'
  | 'number'
  | 'year'
  | 'day'
  | 'month'
  | 'date'
  | 'year-month'
  | 'share'
  | 'address'
  | 'order-number'
  | 'multiline';

export interface ValidationResult {
  ok: boolean;
  /** Cleaned/normalized value (whitespace trimmed etc.) */
  value: string;
  /** Translation key for the failure reason. */
  errorKey?: string;
}

// Apostrophe-like characters accepted inside a name. Uzbek Latin uses
// these for `oʻ` / `gʻ` digraphs and people enter them in many wildly
// different ways depending on keyboard layout / IME / autocorrect:
//   '  U+0027  APOSTROPHE                (ASCII keyboard)
//   `  U+0060  GRAVE ACCENT              (frequent fat-finger swap)
//   ʻ  U+02BB  MODIFIER LETTER TURNED COMMA  (OFFICIAL Uzbek Latin)
//   ʼ  U+02BC  MODIFIER LETTER APOSTROPHE
//   ʹ  U+02B9  MODIFIER LETTER PRIME
//   ‘  U+2018  LEFT SINGLE QUOTATION MARK    (smart-quote left)
//   ’  U+2019  RIGHT SINGLE QUOTATION MARK   (smart-quote right; iOS default)
// All seven are visually equivalent for a personal name — the validator
// must accept any of them.
const APOSTROPHES = "'`ʻʼʹ‘’";
const RU_UZ_LETTERS = `A-Za-zА-Яа-яЁёЎўҚқҲҳҒғ${APOSTROPHES}.\\-`;

const PATTERNS: Record<
  Exclude<ValidatorKind, 'text' | 'multiline' | 'date' | 'year-month'>,
  RegExp
> = {
  fio: new RegExp(`^[${RU_UZ_LETTERS}][${RU_UZ_LETTERS}\\s]{4,}$`, 'u'),
  phone: /^\+998\d{9}$/,
  money: /^[\d][\d\s.,]{0,30}$/,
  number: /^\d{1,5}$/,
  year: /^\d{4}$/,
  day: /^([1-9]|[12]\d|3[01])$/,
  month: /^[A-Za-zА-Яа-яЁёҚқҲҳҒғ]{3,12}$/u,
  share: /^\d{1,2}\/\d{1,2}$/,
  address: /^.{10,}$/u,
  'order-number': /^\d{1,3}-\d{2,5}-\d{2,5}\/\d{2,8}$/,
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Parse and canonicalize a user-typed date.
 * Accepted forms:
 *   12.05.2015 / 12/05/2015 / 12-05-2015
 *   12.5.2015 (single-digit day/month auto-padded)
 *   2015 yil 12 may  /  2015 йил 12 май
 * Returns canonical "DD.MM.YYYY" or null on failure. Also validates the
 * calendar (no 31 Feb etc.) and bounds 1900–2100.
 */
export function parseUserDate(input: string): string | null {
  const trimmed = input.trim();

  // Numeric form: DD<sep>MM<sep>YYYY
  const num = /^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})$/u.exec(trimmed);
  if (num) {
    const d = +num[1]!;
    const m = +num[2]!;
    const y = +num[3]!;
    if (y < 1900 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > daysInMonth(y, m)) return null;
    return `${pad2(d)}.${pad2(m)}.${y}`;
  }

  // Natural form: "2015 yil 12 may" / "2015 йил 12 май"
  const nat = /^(\d{4})\s+(йил|yil)\s+(\d{1,2})\s+(\S+)$/iu.exec(trimmed);
  if (nat) {
    const y = +nat[1]!;
    const d = +nat[3]!;
    const monthWord = nat[4]!.toLowerCase();
    const monthMap: Record<string, number> = {
      // uz_cyrillic
      'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'май': 5, 'июн': 6,
      'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12,
      // uz_latin
      'yanvar': 1, 'fevral': 2, 'aprel': 4, 'iyun': 6, 'iyul': 7, 'avgust': 8,
      'sentabr': 9, 'oktabr': 10, 'noyabr': 11, 'dekabr': 12,
      // ru (nominative + genitive)
      'январь': 1, 'января': 1, 'февраль': 2, 'февраля': 2, 'марта': 3,
      'апрель': 4, 'апреля': 4, 'мая': 5, 'июнь': 6, 'июня': 6,
      'июль': 7, 'июля': 7, 'августа': 8, 'сентябрь': 9, 'сентября': 9,
      'октябрь': 10, 'октября': 10, 'ноябрь': 11, 'ноября': 11,
      'декабрь': 12, 'декабря': 12,
    };
    const m = monthMap[monthWord];
    if (!m) return null;
    if (y < 1900 || y > 2100) return null;
    if (d < 1 || d > daysInMonth(y, m)) return null;
    return `${pad2(d)}.${pad2(m)}.${y}`;
  }

  return null;
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  // uz_cyrillic
  'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'май': 5, 'июн': 6,
  'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12,
  // uz_latin
  'yanvar': 1, 'fevral': 2, 'aprel': 4, 'iyun': 6, 'iyul': 7, 'avgust': 8,
  'sentabr': 9, 'oktabr': 10, 'noyabr': 11, 'dekabr': 12,
  // ru (nominative + genitive)
  'январь': 1, 'января': 1, 'февраль': 2, 'февраля': 2, 'марта': 3,
  'апрель': 4, 'апреля': 4, 'мая': 5, 'июнь': 6, 'июня': 6,
  'июль': 7, 'июля': 7, 'августа': 8, 'сентябрь': 9, 'сентября': 9,
  'октябрь': 10, 'октября': 10, 'ноябрь': 11, 'ноября': 11,
  'декабрь': 12, 'декабря': 12,
};

/**
 * Parse a user-typed year-month into canonical "MM.YYYY".
 * Accepted forms:
 *   "yanvar 2024" / "январ 2024" / "январь 2024" / "2024 yanvar" / "2024 yil yanvar"
 *   "01.2024" / "01/2024" / "1.2024"
 */
export function parseUserYearMonth(input: string): string | null {
  const trimmed = input.trim();

  // Numeric form: MM<sep>YYYY
  const num = /^(\d{1,2})[\.\/\-](\d{4})$/u.exec(trimmed);
  if (num) {
    const m = +num[1]!;
    const y = +num[2]!;
    if (y < 1900 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    return `${pad2(m)}.${y}`;
  }

  // Natural form with optional "yil"/"йил" filler between/around.
  const lower = trimmed.toLowerCase();
  const yearMatch = lower.match(/\b(\d{4})\b/);
  if (!yearMatch) return null;
  const y = +yearMatch[1]!;
  if (y < 1900 || y > 2100) return null;

  for (const [name, idx] of Object.entries(MONTH_NAME_TO_INDEX)) {
    if (lower.includes(name)) {
      return `${pad2(idx)}.${y}`;
    }
  }
  return null;
}

/**
 * Normalize a phone number to E.164 (+998901234567 form).
 * Default country is Uzbekistan, so the user can enter:
 *   "90 123 45 67"    → +998901234567
 *   "(90) 123 45 67"  → +998901234567
 *   "+998 90 123-45-67" → +998901234567
 *   "8 (901) 234-56-78" → +79012345678 (works for RU too)
 * If parsing fails completely we return the digits-stripped input so the
 * regex fallback in `validate()` can still reject it.
 */
function normalizePhone(raw: string): string {
  try {
    const parsed = parsePhoneNumberFromString(raw, 'UZ');
    if (parsed?.isValid()) return parsed.number; // E.164
  } catch {
    /* fall through */
  }
  // Legacy fallback for offline-style entries (no country code).
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('998')) return '+' + digits;
  if (digits.length === 9) return '+998' + digits;
  return digits;
}

export function validate(
  kind: ValidatorKind,
  rawValue: string,
): ValidationResult {
  const trimmed = rawValue.trim();

  switch (kind) {
    case 'text': {
      const ok = trimmed.length >= 2;
      return { ok, value: trimmed, errorKey: ok ? undefined : 'val.text' };
    }
    case 'multiline': {
      const ok = trimmed.length >= 2;
      return { ok, value: trimmed, errorKey: ok ? undefined : 'val.text' };
    }
    case 'phone': {
      const normalized = normalizePhone(trimmed);
      // Prefer libphonenumber's view of validity (catches things like
      // wrong-length UZ numbers that the strict regex would let through).
      let ok = false;
      try {
        const parsed = parsePhoneNumberFromString(trimmed, 'UZ');
        ok = parsed?.isValid() ?? false;
      } catch {
        ok = false;
      }
      // Fallback: the original strict +998-only regex.
      if (!ok) ok = PATTERNS.phone.test(normalized);
      return {
        ok,
        value: ok ? normalized : trimmed,
        errorKey: ok ? undefined : 'val.phone',
      };
    }
    case 'date': {
      const canonical = parseUserDate(trimmed);
      return canonical !== null
        ? { ok: true, value: canonical }
        : { ok: false, value: trimmed, errorKey: 'val.date' };
    }
    case 'year-month': {
      const canonical = parseUserYearMonth(trimmed);
      return canonical !== null
        ? { ok: true, value: canonical }
        : { ok: false, value: trimmed, errorKey: 'val.year-month' };
    }
    default: {
      const pattern = PATTERNS[kind];
      const ok = pattern.test(trimmed);
      return {
        ok,
        value: trimmed,
        errorKey: ok ? undefined : `val.${kind}`,
      };
    }
  }
}

export function explainError(
  kind: ValidatorKind,
  errorKey: string,
  locale: Locale,
): string {
  return t(locale, 'val.fail', { reason: t(locale, errorKey) });
}
