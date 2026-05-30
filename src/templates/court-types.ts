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
    active: true,
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
    active: true,
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

/**
 * Categories shown at the FIRST step of the "📋 Ишимни текшириш"
 * schedule flow. Mirrors jadval2.sud.uz `jib`: two subtypes —
 * criminal (jib/jib → api4) and administrative-offences
 * (jib/mhb → api5). NOT the same as the 4 ariza court types.
 */
export const SCHEDULE_CATEGORIES: CourtTypeDef[] = [
  {
    code: 'jinoyat',
    label: L(
      'Жиноят ишлар бўйича суд мажлисига тайинланган ишлар рўйхати',
      'Jinoyat ishlar boʻyicha sud majlisiga tayinlangan ishlar roʻyxati',
      'Список дел по уголовным делам, назначенных к судебному заседанию',
    ),
    active: true,
  },
  {
    code: 'mhb',
    label: L(
      'Маъмурий ҳуқуқбузарликлар бўйича суд мажлисига тайинланган ишлар рўйхати',
      'Maʼmuriy huquqbuzarliklar boʻyicha sud majlisiga tayinlangan ishlar roʻyxati',
      'Список дел об административных правонарушениях, назначенных к заседанию',
    ),
    active: true,
  },
];

export function getScheduleCategoryByCode(code: string): CourtTypeDef | undefined {
  return SCHEDULE_CATEGORIES.find((c) => c.code === code);
}
