import type { Locale } from '../i18n';

/**
 * Court type — top level of the multi-step picker the user sees right
 * after pressing "Ariza topshirish". Only one type (`fuqarolik`) is
 * currently `active`; the others are placeholders shown with a
 * "coming soon" toast until templates for them are written.
 */
export interface CourtTypeDef {
  code: string;
  label: Record<Locale, string>;
  /** When false — show a "coming soon" reply and stop the flow. */
  active: boolean;
}

function L(cy: string, la: string, ru: string): Record<Locale, string> {
  return { uz_cyrillic: cy, uz_latin: la, ru };
}

export const COURT_TYPES: CourtTypeDef[] = [
  {
    code: 'jinoyat',
    label: L(
      '⚖️ Жиноят ишлари бўйича',
      '⚖️ Jinoyat ishlari boʻyicha',
      '⚖️ По уголовным делам',
    ),
    active: true,
  },
  {
    code: 'mamuriy',
    label: L(
      '📋 Маъмурий ишлар бўйича',
      '📋 Mamuriy ishlar boʻyicha',
      '📋 По административным делам',
    ),
    active: false,
  },
  {
    code: 'fuqarolik',
    label: L(
      '👨‍👩‍👧 Фуқаролик ишлари бўйича',
      '👨‍👩‍👧 Fuqarolik ishlari boʻyicha',
      '👨‍👩‍👧 По гражданским делам',
    ),
    active: true,
  },
  {
    code: 'iqtisodiy',
    label: L(
      '💼 Иқтисодий ишлар бўйича',
      '💼 Iqtisodiy ishlar boʻyicha',
      '💼 По экономическим делам',
    ),
    active: false,
  },
  {
    code: 'oliy',
    label: L(
      '🏛 Олий Судга',
      '🏛 Oliy Sudga',
      '🏛 В Верховный суд',
    ),
    active: false,
  },
];

export function getCourtTypeByCode(code: string): CourtTypeDef | undefined {
  return COURT_TYPES.find((c) => c.code === code);
}
