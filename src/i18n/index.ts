import { uz_cyrillic } from './translations/uz_cyrillic';
import { uz_latin } from './translations/uz_latin';
import { ru } from './translations/ru';

export const LOCALES = ['uz_cyrillic', 'uz_latin', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_META: Record<Locale, { code: Locale; flag: string; label: string }> = {
  uz_cyrillic: { code: 'uz_cyrillic', flag: '🇺🇿', label: "Ўзбекча (кирилл)" },
  uz_latin:    { code: 'uz_latin',    flag: '🇺🇿', label: "O‘zbekcha (lotin)" },
  ru:          { code: 'ru',          flag: '🇷🇺', label: 'Русский' },
};

export type Dict = Record<string, string>;
const DICTS: Record<Locale, Dict> = { uz_cyrillic, uz_latin, ru };

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[locale] ?? DICTS.uz_cyrillic;
  let s = dict[key] ?? DICTS.uz_cyrillic[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}
