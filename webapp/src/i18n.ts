import type { Locale } from './tg';

const DICT = {
  uz_cyrillic: {
    'title.jadval': 'Ишимни текшириш',
    'title.types': 'Иш турини танланг',
    'title.regions': 'Ҳудудни танланг',
    'title.courts': 'Судни танланг',
    'title.date': 'Санани танланг',
    'title.results': 'Иш рўйхати',
    'btn.search': '🔍 Қидириш',
    'btn.clear': '✕ Тозалаш',
    'btn.change-date': '📅 Бошқа сана',
    'btn.back': '⬅️ Орқага',
    'search.placeholder': 'ФИО ёки иш рақами...',
    'schedule.total': '<b>{n}</b> та иш',
    'schedule.matched': 'Топилди: <b>{m}</b> / {n}',
    'schedule.empty': 'Ушбу санага иш йўқ',
    'schedule.search-empty': 'Сўров бўйича ҳеч нарса топилмади',
    'cal.weekdays': 'Дш Сш Чш Пш Жм Шн Як',
    'cal.past': 'Ўтган санадаги ишлар сақланмайди',
    'months': 'январ,феврал,март,апрел,май,июн,июл,август,сентябр,октябр,ноябр,декабр',
    'fields.case': 'Иш рақами',
    'fields.time': 'Вақт',
    'fields.category': 'Туркум',
    'fields.judge': 'Судья',
    'fields.instance': 'Инстанция',
    'fields.claimant': 'Даъвогар',
    'fields.defendant': 'Жавобгар',
    'fields.accused': 'Судланувчи',
    'fields.victim': 'Жабрланувчи',
    'error.network': 'Тармоқ хатоси. Қайта уриниб кўринг.',
    'error.api': 'Маълумотларни олиб бўлмади',
    'loading': 'Юкланмоқда...',
  },
  uz_latin: {
    'title.jadval': 'Ishimni tekshirish',
    'title.types': 'Ish turini tanlang',
    'title.regions': 'Hududni tanlang',
    'title.courts': 'Sudni tanlang',
    'title.date': 'Sanani tanlang',
    'title.results': 'Ish ro‘yxati',
    'btn.search': '🔍 Qidirish',
    'btn.clear': '✕ Tozalash',
    'btn.change-date': '📅 Boshqa sana',
    'btn.back': '⬅️ Orqaga',
    'search.placeholder': 'F.I.SH. yoki ish raqami...',
    'schedule.total': '<b>{n}</b> ta ish',
    'schedule.matched': 'Topildi: <b>{m}</b> / {n}',
    'schedule.empty': 'Ushbu sanaga ish yo‘q',
    'schedule.search-empty': 'So‘rov bo‘yicha hech narsa topilmadi',
    'cal.weekdays': 'Du Se Ch Pa Ju Sh Ya',
    'cal.past': 'O‘tgan sanadagi ishlar saqlanmaydi',
    'months': 'yanvar,fevral,mart,aprel,may,iyun,iyul,avgust,sentyabr,oktyabr,noyabr,dekabr',
    'fields.case': 'Ish raqami',
    'fields.time': 'Vaqt',
    'fields.category': 'Turkum',
    'fields.judge': 'Sudya',
    'fields.instance': 'Instansiya',
    'fields.claimant': 'Da’vogar',
    'fields.defendant': 'Javobgar',
    'fields.accused': 'Sudlanuvchi',
    'fields.victim': 'Jabrlanuvchi',
    'error.network': 'Tarmoq xatosi. Qayta urinib ko‘ring.',
    'error.api': 'Ma’lumotlarni olib bo‘lmadi',
    'loading': 'Yuklanmoqda...',
  },
  ru: {
    'title.jadval': 'Проверить дело',
    'title.types': 'Выберите тип дела',
    'title.regions': 'Выберите область',
    'title.courts': 'Выберите суд',
    'title.date': 'Выберите дату',
    'title.results': 'Список дел',
    'btn.search': '🔍 Поиск',
    'btn.clear': '✕ Очистить',
    'btn.change-date': '📅 Другая дата',
    'btn.back': '⬅️ Назад',
    'search.placeholder': 'ФИО или номер дела...',
    'schedule.total': '<b>{n}</b> дел',
    'schedule.matched': 'Найдено: <b>{m}</b> из {n}',
    'schedule.empty': 'На эту дату дел нет',
    'schedule.search-empty': 'По запросу ничего не найдено',
    'cal.weekdays': 'Пн Вт Ср Чт Пт Сб Вс',
    'cal.past': 'Дела за прошлые даты не сохраняются',
    'months': 'январь,февраль,март,апрель,май,июнь,июль,август,сентябрь,октябрь,ноябрь,декабрь',
    'fields.case': 'Номер дела',
    'fields.time': 'Время',
    'fields.category': 'Категория',
    'fields.judge': 'Судья',
    'fields.instance': 'Инстанция',
    'fields.claimant': 'Истец',
    'fields.defendant': 'Ответчик',
    'fields.accused': 'Подсудимый',
    'fields.victim': 'Потерпевший',
    'error.network': 'Ошибка сети. Попробуйте ещё раз.',
    'error.api': 'Не удалось получить данные',
    'loading': 'Загрузка...',
  },
} as const satisfies Record<Locale, Record<string, string>>;

type DictKey = keyof (typeof DICT)['ru'];

export function t(
  locale: Locale,
  key: DictKey,
  vars?: Record<string, string | number>,
): string {
  let s: string =
    (DICT[locale] as Record<string, string> | undefined)?.[key] ??
    (DICT.uz_cyrillic as Record<string, string>)[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function monthNames(locale: Locale): string[] {
  return t(locale, 'months').split(',');
}
