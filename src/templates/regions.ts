import type { Locale } from '../i18n';

export interface RegionDef {
  /** Stable machine code used in callback data. */
  code: string;
  /** Localized button label shown in the region picker. */
  label: Record<Locale, string>;
  /**
   * Court name written into the document header (placed before
   * "туманлараро суди" in the template).
   * Example: "Жиззах" → "ФУҚАРОЛИК ИШЛАРИ БЎЙИЧА ЖИЗЗАХ ТУМАНЛАРАРО СУДИ РАИСИ"
   */
  courtName: Record<Locale, string>;
  /** Judge / court chair full short name. Example: "Ш.Омонов". */
  judgeName: Record<Locale, string>;
}

function L(cy: string, la: string, ru: string): Record<Locale, string> {
  return { uz_cyrillic: cy, uz_latin: la, ru };
}

export const REGIONS: RegionDef[] = [
  {
    code: 'andijan',
    label: L('Андижон вилояти', 'Andijon viloyati', 'Андижанская область'),
    courtName: L('Андижон', 'Andijon', 'Андижан'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'bukhara',
    label: L('Бухоро вилояти', 'Buxoro viloyati', 'Бухарская область'),
    courtName: L('Бухоро', 'Buxoro', 'Бухара'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'jizzakh',
    label: L('Жиззах вилояти', 'Jizzax viloyati', 'Джизакская область'),
    courtName: L('Жиззах', 'Jizzax', 'Джизак'),
    judgeName: L('Ш.Омонов', 'Sh.Omonov', 'Ш.Омонов'),
  },
  {
    code: 'kashkadarya',
    label: L('Қашқадарё вилояти', 'Qashqadaryo viloyati', 'Кашкадарьинская область'),
    courtName: L('Қашқадарё', 'Qashqadaryo', 'Кашкадарья'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'karakalpakstan',
    label: L('Қорақалпоғистон Республикаси', 'Qoraqalpogʻiston Respublikasi', 'Республика Каракалпакстан'),
    courtName: L('Қорақалпоғистон', 'Qoraqalpogʻiston', 'Каракалпакстан'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'navoi',
    label: L('Навоий вилояти', 'Navoiy viloyati', 'Навоийская область'),
    courtName: L('Навоий', 'Navoiy', 'Навои'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'namangan',
    label: L('Наманган вилояти', 'Namangan viloyati', 'Наманганская область'),
    courtName: L('Наманган', 'Namangan', 'Наманган'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'samarkand',
    label: L('Самарқанд вилояти', 'Samarqand viloyati', 'Самаркандская область'),
    courtName: L('Самарқанд', 'Samarqand', 'Самарканд'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'syrdarya',
    label: L('Сирдарё вилояти', 'Sirdaryo viloyati', 'Сырдарьинская область'),
    courtName: L('Сирдарё', 'Sirdaryo', 'Сырдарья'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'surkhandarya',
    label: L('Сурхондарё вилояти', 'Surxondaryo viloyati', 'Сурхандарьинская область'),
    courtName: L('Сурхондарё', 'Surxondaryo', 'Сурхандарья'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'tashkent_region',
    label: L('Тошкент вилояти', 'Toshkent viloyati', 'Ташкентская область'),
    courtName: L('Тошкент', 'Toshkent', 'Ташкент'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'tashkent_city',
    label: L('Тошкент шаҳар', 'Toshkent shahar', 'город Ташкент'),
    courtName: L('Тошкент шаҳар', 'Toshkent shahar', 'город Ташкент'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'fergana',
    label: L('Фарғона вилояти', 'Fargʻona viloyati', 'Ферганская область'),
    courtName: L('Фарғона', 'Fargʻona', 'Фергана'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'khorezm',
    label: L('Хоразм вилояти', 'Xorazm viloyati', 'Хорезмская область'),
    courtName: L('Хоразм', 'Xorazm', 'Хорезм'),
    judgeName: L('___________', '___________', '___________'),
  },
  {
    code: 'supreme',
    label: L('Олий суд', 'Oliy sud', 'Верховный суд'),
    courtName: L('Олий', 'Oliy', 'Верховный'),
    judgeName: L('___________', '___________', '___________'),
  },
];

export function getRegionByCode(code: string): RegionDef | undefined {
  return REGIONS.find((r) => r.code === code);
}
