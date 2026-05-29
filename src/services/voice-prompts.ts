import type { Locale } from '../i18n';

/**
 * Whisper-prompt strings, keyed by (locale × field-validator). Used as
 * the `prompt` parameter on Audio Transcriptions calls so the STT model
 * has a vocabulary anchor for the kind of content it's about to hear.
 *
 * Whisper's prompt should be SHORT (≤244 tokens), in the same language
 * as the audio, and contain example phrases — NOT instructions. The
 * model essentially uses it as "previous-context", so a few well-chosen
 * sample names / addresses dramatically improve accuracy on Uzbek
 * Cyrillic where whisper-1 otherwise drops ў/ҳ/ғ/қ and mangles FIO.
 *
 * Returns `undefined` when no useful prompt exists for the field —
 * the caller skips the prompt parameter entirely in that case.
 */
export function buildWhisperPrompt(
  validator: string,
  locale: Locale,
): string | undefined {
  const map = PROMPTS[locale];
  return map[validator];
}

const UZ_CY: Record<string, string> = {
  fio:
    'Ўзбек исм-шарифи кириллицада. Масалан: Каримов Алишер Расулович, ' +
    'Сулайманова Дилнура Шарифовна, Тошматов Бахтиёр Эркинович, ' +
    'Юсупова Гулнора Маҳмудовна, Раҳмонов Шерзод Қодирович.',
  address:
    'Ўзбекистон манзили. Масалан: Тошкент шаҳри, Чилонзор тумани, ' +
    'Бунёдкор кўчаси, 12-уй, 5-хонадон. Андижон вилояти, Асака тумани, ' +
    'Ёшлик МФЙ, Алишер Навоий кўчаси, 45-уй. Фарғона вилояти, Қўқон шаҳри.',
  text:
    'Расмий ҳужжат матни ўзбек тилида кириллицада. Ариза, эътирознома, ' +
    'мурожаат, тушунтириш хати.',
  multiline:
    'Суд аризасининг мотивировка қисми. Ҳолатлар, далиллар, қонун ' +
    'бандлари. Ўзбек тилида расмий услубда.',
};

const UZ_LA: Record<string, string> = {
  fio:
    "O'zbek ism-sharifi lotin yozuvida. Masalan: Karimov Alisher Rasulovich, " +
    "Sulaymonova Dilnura Sharifovna, Toshmatov Baxtiyor Erkinovich, " +
    "Yusupova Gulnora Mahmudovna, Rahmonov Sherzod Qodirovich.",
  address:
    "O'zbekiston manzili. Masalan: Toshkent shahri, Chilonzor tumani, " +
    "Bunyodkor ko'chasi, 12-uy, 5-xonadon. Andijon viloyati, Asaka tumani, " +
    "Yoshlik MFY, Alisher Navoiy ko'chasi, 45-uy. Farg'ona viloyati, Qo'qon shahri.",
  text:
    "Rasmiy hujjat matni o'zbek tilida lotin yozuvida. Ariza, e'tiroznoma, " +
    "murojaat, tushuntirish xati.",
  multiline:
    "Sud arizasining motivirovka qismi. Holatlar, dalillar, qonun " +
    "bandlari. O'zbek tilida rasmiy uslubda.",
};

const RU: Record<string, string> = {
  fio:
    'Русские и узбекские ФИО. Например: Иванов Алексей Петрович, ' +
    'Каримов Алишер Расулович, Петрова Мария Сергеевна, ' +
    'Сулайманова Дилнура Шарифовна, Юсупов Бахтиёр Эркинович.',
  address:
    'Адрес в Узбекистане. Например: город Ташкент, Чиланзарский район, ' +
    'улица Бунёдкор, дом 12, квартира 5. Андижанская область, Асакинский ' +
    'район, махалля Ёшлик, улица Алишера Навои, дом 45.',
  text:
    'Официальный текст документа на русском языке: заявление, возражение, ' +
    'обращение, объяснительная.',
  multiline:
    'Мотивировочная часть судебного заявления. Обстоятельства дела, ' +
    'доказательства, ссылки на статьи закона. Официально-деловой стиль.',
};

const PROMPTS: Record<Locale, Record<string, string>> = {
  uz_cyrillic: UZ_CY,
  uz_latin: UZ_LA,
  ru: RU,
};
