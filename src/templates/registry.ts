import type { Locale } from '../i18n';
import type { FieldDef, TemplateDef } from '../types';

/** Tiny helper to keep TS happy without repeating Locale keys. */
function L(
  cy: string,
  la: string,
  ru: string,
): Record<Locale, string> {
  return { uz_cyrillic: cy, uz_latin: la, ru };
}

/*
 * NOTE: `court_name` and `judge_name` are NOT collected as user input.
 * They are pre-filled from the selected region (see `regions.ts`)
 * and merged into the document data in `DocumentService.build`.
 */

/* convenience field factories */
const F = {
  fio: (
    key: string,
    label: Record<Locale, string>,
    hint?: Record<Locale, string>,
  ): FieldDef => ({ key, validator: 'fio', label, hint }),
  phone: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'phone',
    label,
    hint: L('+998901234567', '+998901234567', '+998901234567'),
  }),
  address: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'address',
    multiline: true,
    hintCopyable: true,
    label,
    hint: L(
      'Тошкент ш., Юнусобод т., Амир Темур МФЙ, Шарқ кўчаси, 12-уй',
      "Toshkent sh., Yunusobod t., Amir Temur MFY, Sharq ko‘chasi, 12-uy",
      'г. Ташкент, Юнусабадский р-н, МФЙ Амир Темур, ул. Шарк, дом 12',
    ),
  }),
  money: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'money',
    label,
    hint: L('Масалан: 1.063.445,21', 'Masalan: 1.063.445,21', 'Например: 1.063.445,21'),
  }),
  num: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'number',
    label,
    hint: L('Бутун сон', "Butun son", 'Целое число'),
  }),
  year: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'year',
    label,
    hint: L('Масалан: 2025', 'Masalan: 2025', 'Например: 2025'),
  }),
  month: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'month',
    label,
    hint: L('Масалан: январ', "Masalan: yanvar", 'Например: январь'),
  }),
  day: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'day',
    label,
    hint: L('1—31', '1—31', '1—31'),
  }),
  date: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'date',
    label,
    hint: L(
      'Масалан: 12.05.2015',
      "Masalan: 12.05.2015",
      'Например: 12.05.2015',
    ),
  }),
  share: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'share',
    label,
    hint: L('1/4, 1/3, 2/3', '1/4, 1/3, 2/3', '1/4, 1/3, 2/3'),
  }),
  text: (key: string, label: Record<Locale, string>, hint?: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'text',
    label,
    hint,
  }),
  multiline: (key: string, label: Record<Locale, string>, hint?: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'multiline',
    multiline: true,
    label,
    hint,
  }),
  orderNum: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'order-number',
    label,
    hint: L('Масалан: 2-1301-2506/20479', 'Masalan: 2-1301-2506/20479', 'Например: 2-1301-2506/20479'),
  }),
  stir: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'stir',
    label,
    hint: L(
      'Корхонанинг СТИРи (9 рақам). Масалан: 201 988 537',
      "Korxonaning STIR raqami (9 raqam). Masalan: 201 988 537",
      'СТИР организации (9 цифр). Например: 201 988 537',
    ),
    hintCopyable: true,
  }),
  pinfl: (key: string, label: Record<Locale, string>): FieldDef => ({
    key,
    validator: 'pinfl',
    label,
    hint: L(
      'ЖШШИР (14 рақам). Паспортда ёзилган. Масалан: 31008911831636',
      "JSHSHIR (14 raqam). Pasportda yozilgan. Masalan: 31008911831636",
      'ПИНФЛ (14 цифр). Указан в паспорте. Например: 31008911831636',
    ),
    hintCopyable: true,
  }),
  choice: (
    key: string,
    label: Record<Locale, string>,
    choices: NonNullable<FieldDef['choices']>,
  ): FieldDef => ({
    key,
    validator: 'choice',
    label,
    choices,
  }),
  /**
   * Composite date — one calendar pick that fills 2–3 separate value keys.
   * Use when the .docx template has separate {{x_year}} / {{x_month}} / {{x_day}}
   * placeholders that all describe the same calendar date.
   */
  splitDate: (
    key: string,
    label: Record<Locale, string>,
    split: { yearKey?: string; monthKey: string; dayKey: string },
  ): FieldDef => ({
    key,
    validator: 'date',
    label,
    hint: L(
      'Календардан танланг ёки: 12.05.2015',
      "Kalendardan tanlang yoki: 12.05.2015",
      'Выберите из календаря или: 12.05.2015',
    ),
    splitDate: split,
  }),
};

/**
 * Per-child name + date-of-birth fields. The wizard asks them one by one
 * for as many children as `children_count` indicates (capped at MAX_KIDS).
 * Document.service aggregates them into the legacy `children_names` and
 * `children_birth_date` placeholders used by the .docx templates.
 */
const MAX_KIDS = 5;
function childFields(): FieldDef[] {
  const out: FieldDef[] = [];
  for (let i = 1; i <= MAX_KIDS; i++) {
    const idx = i;
    out.push({
      key: `child${idx}_name`,
      validator: 'fio',
      label: L(
        `👶 ${idx}-фарзанд Ф.И.Ш.`,
        `👶 ${idx}-farzand F.I.SH.`,
        `👶 Ребёнок ${idx}: Ф.И.О.`,
      ),
      skipIf: (v) => Number(v.children_count ?? '0') < idx,
    });
    out.push({
      key: `child${idx}_dob`,
      validator: 'date',
      // Also split into year/month/day sub-keys so the docx templates can
      // render "<year> йил <month> ойининг <day> кунида туғилган" with the
      // single-child case from the sample form.
      splitDate: {
        yearKey: `child${idx}_dob_year`,
        monthKey: `child${idx}_dob_month`,
        dayKey: `child${idx}_dob_day`,
      },
      label: L(
        `🍼 ${idx}-фарзанд туғилган сана`,
        `🍼 ${idx}-farzand tug‘ilgan sana`,
        `🍼 Ребёнок ${idx}: дата рождения`,
      ),
      hint: L('Масалан: 12.05.2018', 'Masalan: 12.05.2018', 'Например: 12.05.2018'),
      skipIf: (v) => Number(v.children_count ?? '0') < idx,
    });
  }
  return out;
}

/* ============================================================ */
/* 1. Алимент ундириш (суд буйруғи учун) */
const T_ARIZA_ALIMENT: TemplateDef = {
  code: 'ariza-aliment-undirish',
  category: 'ariza',
  title: L(
    '📄 Алимент ундириш',
    "📄 Aliment undirish",
    '📄 Взыскание алиментов',
  ),
  subtitle: L(
    'суд буйруғи учун',
    "sud buyrug‘i uchun",
    'для судебного приказа',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `⚖️ <b>Суд буйруғи орқали алимент ундириш</b>\n\n📋 <b>Қачон бериш:</b>\nБошқа ота-она моддий ёрдам бермаса ва оталик бўйича низо бўлмаганда. Ҳам ажрашганлар, ҳам бирга яшаб тўламаётганлар учун мос келади.\n\n🏛 <b>Қаерга:</b>\nУндирувчининг яшаш жойи бўйича туманлараро фуқаролик суди.\n\n📎 <b>Илова қилинадиган ҳужжатлар:</b>\n• Ундирувчи паспорти нусхаси\n• Никоҳ ёки уни бекор қилиш гувоҳномаси\n• Фарзандлар туғилганлик гувоҳномаси\n• Оила таркиби маълумотномаси (маҳалладан)\n• Қарздорнинг иш ҳақи маълумотномаси (бўлса)\n\n💰 <b>Алимент миқдори:</b>\n• 1 фарзанд — иш ҳақининг 1/4 қисми\n• 2 фарзанд — 1/3\n• 3 ва ундан кўп — 1/2\n\n⏱ <b>Муддат:</b> 5 кун (буйруқ ишлаб чиқариш — тез процедура).\n\n📝 <b>Бот сўрайди:</b>\nУндирувчи Ф.И.Ш., манзил, телефон → қарздор маълумотлари → никоҳ санаси → фарзандлар сони ва маълумотлари → қачондан буён алоҳида яшайсиз.`,
    `⚖️ <b>Sud buyrug‘i orqali aliment undirish</b>\n\n📋 <b>Qachon berish:</b>\nBoshqa ota-ona moddiy yordam bermasa va otalik bo‘yicha nizo bo‘lmaganda. Ajrashganlar ham, birga yashab to‘lamayotganlar ham foydalanishi mumkin.\n\n🏛 <b>Qayerga:</b>\nUndiruvchining yashash joyi bo‘yicha tumanlararo fuqarolik sudi.\n\n📎 <b>Ilova qilinadigan hujjatlar:</b>\n• Undiruvchi pasporti nusxasi\n• Nikoh yoki uni bekor qilish guvohnomasi\n• Farzandlar tug‘ilganlik guvohnomasi\n• Oila tarkibi ma'lumotnomasi (mahalladan)\n• Qarzdorning ish haqi ma'lumotnomasi (bo‘lsa)\n\n💰 <b>Aliment miqdori:</b>\n• 1 farzand — ish haqining 1/4 qismi\n• 2 farzand — 1/3\n• 3 va undan ko‘p — 1/2\n\n⏱ <b>Muddat:</b> 5 kun (buyruq ishlab chiqarish — tez protsedura).\n\n📝 <b>Bot so‘raydi:</b>\nUndiruvchi F.I.SH., manzil, telefon → qarzdor ma'lumotlari → nikoh sanasi → farzandlar soni va ma'lumotlari → qachondan buyon alohida yashaysiz.`,
    `⚖️ <b>Взыскание алиментов через судебный приказ</b>\n\n📋 <b>Когда подавать:</b>\nЕсли другой родитель не помогает финансово ребёнку и нет спора об отцовстве. Подходит и для разведённых, и для совместно проживающих, если один не платит.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства взыскателя.\n\n📎 <b>Документы для приложения:</b>\n• Копия паспорта взыскателя\n• Свидетельство о браке (или о расторжении)\n• Свидетельства о рождении детей\n• Справка о составе семьи (из махалли)\n• Справка о доходах должника (если есть)\n\n💰 <b>Размер алиментов:</b>\n• 1 ребёнок — 1/4 заработка\n• 2 детей — 1/3\n• 3 и более — 1/2\n\n⏱ <b>Срок рассмотрения:</b> 5 дней (приказное производство, без вызова сторон).\n\n📝 <b>Бот спросит:</b>\nФИО взыскателя, адрес, телефон → данные должника → дата брака → количество и данные детей → с какого момента живёте отдельно.`,
  ),
  fileNameBase: 'ariza-aliment-undirish',
  fields: [
    F.fio('collector_fio', L('👤 Ундирувчи Ф.И.Ш.', "👤 Undiruvchi F.I.SH.", '👤 Взыскатель (Ф.И.О.)')),
    F.address('collector_address', L('🏠 Ундирувчи манзили', '🏠 Undiruvchi manzili', '🏠 Адрес взыскателя')),
    F.phone('collector_phone', L('📱 Ундирувчи телефон', '📱 Undiruvchi telefon', '📱 Телефон взыскателя')),
    F.fio('debtor_fio', L('👤 Қарздор Ф.И.Ш.', '👤 Qarzdor F.I.SH.', '👤 Должник (Ф.И.О.)')),
    F.address('debtor_address', L('🏠 Қарздор манзили', '🏠 Qarzdor manzili', '🏠 Адрес должника')),
    F.phone('debtor_phone', L('📱 Қарздор телефон', '📱 Qarzdor telefon', '📱 Телефон должника')),
    F.splitDate('marriage_date', L('💒 Никоҳ санаси', '💒 Nikoh sanasi', '💒 Дата брака'), {
      yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day',
    }),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    {
      key: 'separation_date',
      validator: 'year-month',
      splitYearMonth: { yearKey: 'separation_year', monthKey: 'separation_month' },
      label: L('💔 Қачондан буён бирга яшамаяпсиз', "💔 Qachondan buyon birga yashamayapsiz", '💔 С какого момента живёте отдельно'),
      hint: L('Календардан йил ва ойни танланг', 'Kalendardan yil va oyni tanlang', 'Выберите год и месяц из календаря'),
    },
  ],
};

/* ============================================================ */
/* 2. Ёшгача таъминот ундириш */
const T_YOSHGACHA: TemplateDef = {
  code: 'davo-ariza-yoshgacha-taminot',
  category: 'davo_ariza',
  title: L(
    '🍼 3 ёшгача таъминот ундириш',
    "🍼 3 yoshgacha ta'minot undirish",
    '🍼 Содержание до 3 лет',
  ),
  subtitle: L(
    '3 йил давомида таъминот',
    "3 yil davomida ta'minot",
    'содержание в течение 3 лет',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `🍼 <b>3 ёшгача фарзанд таъминоти</b>\n\n📋 <b>Қачон бериш:</b>\nЁшингиз 3 дан кичик фарзандингиз бўлиб, эр (ҳозирги ёки собиқ) моддий ёрдам бермаса. Оила кодексига кўра, сиз ўзингиз ишлаётган бўлсангиз ҳам, фарзанд 3 ёшга тўлгунча таъминот талаб қилишга ҳақингиз бор.\n\n🏛 <b>Қаерга:</b>\nАризачининг яшаш жойи бўйича туманлараро фуқаролик суди.\n\n📎 <b>Ҳужжатлар:</b>\n• Аризачи паспорти нусхаси\n• Никоҳ ёки уни бекор қилиш гувоҳномаси\n• 3 ёшгача фарзандлар гувоҳномаси\n• Оила таркиби маълумотномаси\n• Жавобгарнинг иш ҳақи маълумотномаси (бўлса)\n\n💡 <b>Миқдор:</b>\nСуд томонларнинг моддий аҳволига қараб белгилайди. Аризада сиз ҳаққоний деб биладиган суммани кўрсатинг.\n\n⏱ <b>Муддат:</b> 2 ой (даъво иш юритуви).\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → жавобгар маълумотлари → никоҳ санаси → фарзандлар сони ва туғилган саналари → қачондан буён алоҳида яшайсиз → ойлик талаб қилинаётган сумма.`,
    `🍼 <b>3 yoshgacha farzand ta'minoti</b>\n\n📋 <b>Qachon berish:</b>\nYoshi 3 dan kichik farzandingiz bo‘lib, er (hozirgi yoki sobiq) moddiy yordam bermasa. Oila kodeksiga ko‘ra, siz o‘zingiz ishlayotgan bo‘lsangiz ham, farzand 3 yoshga to‘lguncha ta'minot talab qilish huquqingiz bor.\n\n🏛 <b>Qayerga:</b>\nArizachining yashash joyi bo‘yicha tumanlararo fuqarolik sudi.\n\n📎 <b>Hujjatlar:</b>\n• Arizachi pasporti nusxasi\n• Nikoh yoki uni bekor qilish guvohnomasi\n• 3 yoshgacha farzandlar guvohnomasi\n• Oila tarkibi ma'lumotnomasi\n• Javobgarning ish haqi ma'lumotnomasi (bo‘lsa)\n\n💡 <b>Miqdor:</b>\nSud tomonlarning moddiy ahvoliga qarab belgilaydi. Arizada siz haqqoniy deb bilgan summani ko‘rsating.\n\n⏱ <b>Muddat:</b> 2 oy (da'vo ish yurituvi).\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → javobgar ma'lumotlari → nikoh sanasi → farzandlar soni va tug‘ilgan sanalari → qachondan buyon alohida yashaysiz → oylik talab qilinayotgan summa.`,
    `🍼 <b>Содержание ребёнка до 3 лет</b>\n\n📋 <b>Когда подавать:</b>\nЕсли у вас ребёнок младше 3 лет, а супруг (нынешний или бывший) не оказывает финансовой помощи. По Семейному кодексу вы вправе требовать содержание до достижения ребёнком 3 лет — даже если сами работаете.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства заявителя.\n\n📎 <b>Документы:</b>\n• Копия паспорта заявителя\n• Свидетельство о браке (или о разводе)\n• Свидетельства о рождении детей младше 3 лет\n• Справка о составе семьи\n• Справка о доходах ответчика (если есть)\n\n💡 <b>Размер содержания:</b>\nОпределяется судом исходя из материального положения сторон. В аризе укажите сумму, которую считаете справедливой.\n\n⏱ <b>Срок рассмотрения:</b> 2 месяца (исковое производство).\n\n📝 <b>Бот спросит:</b>\nваши данные → данные ответчика → дата брака → количество и даты рождения детей → когда начали жить раздельно → запрашиваемая ежемесячная сумма.`,
  ),
  fileNameBase: 'davo-ariza-yoshgacha-taminot',
  fields: [
    F.fio('plaintiff_fio', L('👤 Аризачи Ф.И.Ш.', '👤 Arizachi F.I.SH.', '👤 Заявитель (Ф.И.О.)')),
    F.address('plaintiff_address', L('🏠 Аризачи манзили', '🏠 Arizachi manzili', '🏠 Адрес заявителя')),
    F.phone('plaintiff_phone', L('📱 Аризачи телефон', '📱 Arizachi telefon', '📱 Телефон заявителя')),
    F.fio('defendant_fio', L('👤 Жавобгар Ф.И.Ш.', '👤 Javobgar F.I.SH.', '👤 Ответчик (Ф.И.О.)')),
    F.address('defendant_address', L('🏠 Жавобгар манзили', '🏠 Javobgar manzili', '🏠 Адрес ответчика')),
    F.phone('defendant_phone', L('📱 Жавобгар телефон', '📱 Javobgar telefon', '📱 Телефон ответчика')),
    F.splitDate('marriage_date', L('💒 Никоҳ санаси', "💒 Nikoh sanasi", '💒 Дата брака'), {
      yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day',
    }),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    {
      key: 'separation_date',
      validator: 'year-month',
      splitYearMonth: { yearKey: 'separation_year', monthKey: 'separation_month' },
      label: L('💔 Қачондан буён бирга яшамаяпсиз', "💔 Qachondan buyon birga yashamayapsiz", '💔 С какого момента живёте отдельно'),
      hint: L('Календардан йил ва ойни танланг', 'Kalendardan yil va oyni tanlang', 'Выберите год и месяц из календаря'),
    },
    F.money('amount', L('💰 Талаб қилинаётган миқдор (сўмда)', "💰 Talab qilinayotgan miqdor (so‘mda)", '💰 Запрашиваемая сумма (в сумах)')),
  ],
};

/* ============================================================ */
/* 3. Эътирознома (суд буйруғини бекор қилиш — савдо дўкони) */
const T_ETIROZ: TemplateDef = {
  code: 'etirozhoma-savdo',
  category: 'etirozhoma',
  title: L(
    '🛡️ Эътирознома',
    "🛡️ E'tiroznoma",
    '🛡️ Возражение',
  ),
  subtitle: L(
    'суд буйруғини бекор қилиш',
    "sud buyrug‘ini bekor qilish",
    'отмена судебного приказа',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `🛡 <b>Суд буйруғига эътирознома</b>\n\n📋 <b>Қачон бериш:</b>\nСизга қарши суд буйруғи чиқарилган бўлса (одатда савдо дўкони ёки микрокредит ташкилоти қарзи бўйича) ва сиз у билан рози бўлмасангиз.\n\n⚠️ <b>МУҲИМ МУДДАТ — 10 кун</b>\nБуйруқ нусхасини <u>қўлингизга олганингиздан</u> бошлаб. Муддатни ўтказсангиз — буйруқ кучга киради ва қарзингиз ундирилиб юборилади.\n\n🏛 <b>Қаерга:</b>\nБуйруқни чиқарган суднинг ўзига. Адрес буйруқда кўрсатилган.\n\n📎 <b>Сизга керак бўлади:</b>\n• Суд буйруғи нусхаси (e-sud.uz ёки приставда)\n• Паспорт нусхаси\n• Сизнинг позициянгизни тасдиқловчи ҳужжатлар (тўлов квитанциялари, ёзишмалар)\n\n💡 <b>Сабаб сифатида ёзилади:</b>\n• Маҳсулот аслида олинмаган\n• Қарз аллақачон тўланган\n• Шартномани имзоламаган\n• Сумма ҳаддан ташқари ошириб юборилган\n• Даъво муддати ўтказиб юборилган\n\n✅ <b>Натижа:</b>\nБуйруқ <u>автоматик бекор қилинади</u>. Дўкон истаса оддий даъво бера олади, лекин у яна суд жараёни орқали ўтиши керак.\n\n📝 <b>Бот сўрайди:</b>\nФ.И.Ш., имзо → манзил → буйруқ санаси ва рақами → ундирувчи номи (дўкон) → буйруқ ҳақида қачон хабар топдингиз → эътироз сабаблари.`,
    `🛡 <b>Sud buyrug‘iga e'tiroznoma</b>\n\n📋 <b>Qachon berish:</b>\nSizga qarshi sud buyrug‘i chiqarilgan bo‘lsa (odatda savdo do‘koni yoki mikrokredit tashkiloti qarzi bo‘yicha) va siz u bilan rozi bo‘lmasangiz.\n\n⚠️ <b>MUHIM MUDDAT — 10 kun</b>\nBuyruq nusxasini <u>qo‘lingizga olganingizdan</u> boshlab. Muddatni o‘tkazsangiz — buyruq kuchga kiradi va qarzingiz undirilib yuboriladi.\n\n🏛 <b>Qayerga:</b>\nBuyruqni chiqargan sudning o‘ziga. Manzil buyruqda ko‘rsatilgan.\n\n📎 <b>Sizga kerak bo‘ladi:</b>\n• Sud buyrug‘i nusxasi (e-sud.uz yoki pristavda)\n• Pasport nusxasi\n• Pozitsiyangizni tasdiqlovchi hujjatlar (to‘lov kvitansiyalari, yozishmalar)\n\n💡 <b>Sabab sifatida yoziladi:</b>\n• Mahsulot aslida olinmagan\n• Qarz allaqachon to‘langan\n• Shartnomani imzolamagan\n• Summa haddan tashqari oshirib yuborilgan\n• Da'vo muddati o‘tkazib yuborilgan\n\n✅ <b>Natija:</b>\nBuyruq <u>avtomatik bekor qilinadi</u>. Do‘kon istasa oddiy da'vo bera oladi, lekin u yana sud jarayoni orqali o‘tishi kerak.\n\n📝 <b>Bot so‘raydi:</b>\nF.I.SH., imzo → manzil → buyruq sanasi va raqami → undiruvchi nomi (do‘kon) → buyruq haqida qachon xabar topdingiz → e'tiroz sabablari.`,
    `🛡 <b>Возражение на судебный приказ</b>\n\n📋 <b>Когда подавать:</b>\nЕсли суд вынес против вас приказ (обычно по долгам перед магазином или микрокредитной организацией), а вы с ним не согласны.\n\n⚠️ <b>КРИТИЧЕСКИЙ СРОК — 10 дней</b>\nС момента <u>получения</u> копии приказа. Пропустите — приказ автоматически вступит в силу, и долг начнут удерживать.\n\n🏛 <b>Куда:</b>\nВ тот же суд, который вынес приказ. Адрес указан на самом приказе.\n\n📎 <b>Что нужно иметь:</b>\n• Копия судебного приказа (с e-sud.uz или у пристава)\n• Копия паспорта\n• Документы вашей позиции (квитанции об оплате, переписка)\n\n💡 <b>Что писать в причинах:</b>\n• Товар фактически не получали\n• Долг уже погашен (есть квитанция)\n• Договор не подписывали\n• Сумма завышена\n• Срок исковой давности пропущен\n\n✅ <b>Эффект:</b>\nПриказ <u>автоматически отменяется</u>. Если магазин захочет — подаст обычный иск, но это уже будет нормальный суд с вызовом сторон.\n\n📝 <b>Бот спросит:</b>\nваши ФИО и подпись → адрес → дата и номер приказа → название взыскателя (магазин) → когда узнали о приказе → причины несогласия.`,
  ),
  fileNameBase: 'etirozhoma-savdo',
  fields: [
    F.fio('plaintiff_fio', L('👤 Аризачи (қарздор) Ф.И.Ш.', '👤 Arizachi (qarzdor) F.I.SH.', '👤 Заявитель (должник) (Ф.И.О.)')),
    F.text('plaintiff_short_fio',
      L('✍️ Аризачи қисқа имзоси', "✍️ Arizachi qisqa imzosi", '✍️ Подпись заявителя'),
      L('Масалан: А.А. Каримов', 'Masalan: A.A. Karimov', 'Например: А.А. Каримов'),
    ),
    F.address('plaintiff_address', L('🏠 Аризачи манзили', '🏠 Arizachi manzili', '🏠 Адрес заявителя')),
    F.phone('plaintiff_phone', L('📱 Аризачи телефон', '📱 Arizachi telefon', '📱 Телефон заявителя')),
    F.splitDate(
      'order_date',
      L('📅 Суд буйруғи санаси', "📅 Sud buyrug‘i sanasi", '📅 Дата судебного приказа'),
      { yearKey: 'order_year', monthKey: 'order_month', dayKey: 'order_day' },
    ),
    // order_number is intentionally not asked — left blank in the document
    // so the user can fill the number by hand on the printed form.
    F.text('creditor_name',
      L('🏪 Ундирувчи (савдо дўкони)', "🏪 Undiruvchi (savdo do‘koni)", '🏪 Взыскатель (магазин)'),
      L('Масалан: "ХАЙРИЯТ" савдо дўкони', "Masalan: «XAYRIYAT» savdo do‘koni", 'Например: «ХАЙРИЯТ» магазин'),
    ),
    F.splitDate(
      'learned_date',
      L('📅 Хабар топган санангиз', "📅 Xabar topgan sanangiz", '📅 Дата, когда узнали'),
      { monthKey: 'learned_month', dayKey: 'learned_day' },
    ),
    // objection_reasons is intentionally not asked — two blank lines are
    // rendered in the document for the user to write reasons by hand.
  ],
};

/* ============================================================ */
/* 4. Алимент миқдорини камайтириш */
const T_KAMAYTIRISH: TemplateDef = {
  code: 'davo-ariza-aliment-kamaytirish',
  category: 'davo_ariza',
  title: L(
    '⚖️ Алимент миқдорини камайтириш',
    "⚖️ Aliment miqdorini kamaytirish",
    '⚖️ Уменьшение размера алиментов',
  ),
  subtitle: L(
    'иккита оила учун қонунга мувофиқлаштириш',
    "ikkita oila uchun qonunga muvofiqlashtirish",
    'приведение в соответствие закону для двух семей',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `⚖️ <b>Алимент миқдорини камайтириш</b>\n\n📋 <b>Қачон бериш:</b>\nСиз иккита алоҳида суд буйруғи бўйича — иккита бошқа никоҳдан фарзандларга — алимент тўлайсиз ва умумий миқдор қонуний максимумдан (иш ҳақининг 1/2 қисми) ошган бўлса.\n\n💡 <b>Мисол:</b>\nБиринчи никоҳдан 1 фарзанд — 1/4 қисми.\nИккинчи никоҳдан 1 фарзанд — яна 1/4. Иккинчи никоҳда яна фарзанд туғилса 1/3 бўлади, жами 1/4 + 1/3 = 7/12 (1/2 дан кўп). Суд буларни қонунга мослаштиради.\n\n🏛 <b>Қаерга:</b>\nТўловчининг яшаш жойи бўйича туманлараро фуқаролик суди.\n\n📎 <b>Ҳужжатлар:</b>\n• Паспорт нусхаси\n• Иккала суд буйруғи нусхаси (биринчи ва иккинчи никоҳдан)\n• Барча фарзандлар туғилганлик гувоҳномаси\n• Иш жойидан ушланмалар маълумотномаси\n• Иш ҳақи маълумотномаси\n\n⏱ <b>Муддат:</b> 2 ой (даъво иш юритуви).\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → биринчи турмуш ўртоғи маълумотлари ва ундан фарзандлар сони → биринчи буйруқ санаси ва улуши → иккинчи турмуш ўртоғи маълумотлари ва ундан фарзандлар сони → иккинчи буйруқ санаси ва улуши → жами фарзандлар сони.`,
    `⚖️ <b>Aliment miqdorini kamaytirish</b>\n\n📋 <b>Qachon berish:</b>\nSiz ikkita alohida sud buyrug‘i bo‘yicha — ikkita boshqa nikohdan farzandlarga — aliment to‘laysiz va umumiy miqdor qonuniy maksimumdan (ish haqining 1/2 qismi) oshgan bo‘lsa.\n\n💡 <b>Misol:</b>\nBirinchi nikohdan 1 farzand — 1/4 qismi.\nIkkinchi nikohdan 1 farzand — yana 1/4. Ikkinchi nikohda yana farzand tug‘ilsa 1/3 bo‘ladi, jami 1/4 + 1/3 = 7/12 (1/2 dan ko‘p). Sud bularni qonunga moslashtiradi.\n\n🏛 <b>Qayerga:</b>\nTo‘lovchining yashash joyi bo‘yicha tumanlararo fuqarolik sudi.\n\n📎 <b>Hujjatlar:</b>\n• Pasport nusxasi\n• Ikkala sud buyrug‘i nusxasi (birinchi va ikkinchi nikohdan)\n• Barcha farzandlar tug‘ilganlik guvohnomasi\n• Ish joyidan ushlanmalar ma'lumotnomasi\n• Ish haqi ma'lumotnomasi\n\n⏱ <b>Muddat:</b> 2 oy (da'vo ish yurituvi).\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → birinchi turmush o‘rtog‘i ma'lumotlari va undan farzandlar soni → birinchi buyruq sanasi va ulushi → ikkinchi turmush o‘rtog‘i ma'lumotlari va undan farzandlar soni → ikkinchi buyruq sanasi va ulushi → jami farzandlar soni.`,
    `⚖️ <b>Уменьшение размера алиментов</b>\n\n📋 <b>Когда подавать:</b>\nВы платите алименты по двум разным судебным приказам — детям от разных браков — и общая сумма превышает законный максимум (1/2 заработка).\n\n💡 <b>Пример:</b>\nПо первому браку 1 ребёнок — 1/4 заработка.\nПо второму браку 1 ребёнок — ещё 1/4. Если родится ещё один — будет 1/3, итого 1/4 + 1/3 = 7/12 (больше 1/2). Суд приведёт доли в соответствие с законом.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства плательщика.\n\n📎 <b>Документы:</b>\n• Копия паспорта\n• Оба судебных приказа (первого и второго брака)\n• Свидетельства о рождении всех детей\n• Справка с места работы об удержаниях\n• Справка о доходах\n\n⏱ <b>Срок рассмотрения:</b> 2 месяца (исковое производство).\n\n📝 <b>Бот спросит:</b>\nваши данные → данные первого супруга и детей от него → дата первого приказа и доля → данные второго супруга и детей → дата второго приказа и доля → общее количество детей.`,
  ),
  fileNameBase: 'davo-ariza-aliment-kamaytirish',
  fields: [
    F.fio('plaintiff_fio', L('👤 Аризачи Ф.И.Ш.', '👤 Arizachi F.I.SH.', '👤 Заявитель (Ф.И.О.)')),
    F.address('plaintiff_address', L('🏠 Аризачи манзили', '🏠 Arizachi manzili', '🏠 Адрес заявителя')),
    F.phone('plaintiff_phone', L('📱 Аризачи телефон', '📱 Arizachi telefon', '📱 Телефон заявителя')),
    F.fio('defendant_fio', L('👤 Жавобгар Ф.И.Ш.', '👤 Javobgar F.I.SH.', '👤 Ответчик (Ф.И.О.)')),
    F.address('defendant_address', L('🏠 Жавобгар манзили', '🏠 Javobgar manzili', '🏠 Адрес ответчика')),
    F.phone('defendant_phone', L('📱 Жавобгар телефон', '📱 Javobgar telefon', '📱 Телефон ответчика')),
    F.fio('first_spouse_fio', L('💍 Биринчи турмуш ўртоғи Ф.И.Ш.', "💍 Birinchi turmush o‘rtog‘i F.I.SH.", '💍 Первый супруг(а) (Ф.И.О.)')),
    F.num('first_children_count', L('👶 Биринчи никоҳдан фарзандлар сони', "👶 Birinchi nikohdan farzandlar soni", '👶 Детей от первого брака')),
    F.splitDate('first_order_date', L('📅 Биринчи суд буйруғи санаси', "📅 Birinchi sud buyrug‘i sanasi", '📅 Дата первого приказа'), {
      yearKey: 'first_order_year', monthKey: 'first_order_month', dayKey: 'first_order_day',
    }),
    F.share('first_alimony_share', L('📊 Биринчи буйруғ улуши', "📊 Birinchi buyruq ulushi", '📊 Доля по первому приказу')),
    F.fio('second_spouse_fio', L('💍 Иккинчи турмуш ўртоғи Ф.И.Ш.', "💍 Ikkinchi turmush o‘rtog‘i F.I.SH.", '💍 Второй супруг(а) (Ф.И.О.)')),
    F.num('second_children_count', L('👶 Иккинчи никоҳдан фарзандлар сони', "👶 Ikkinchi nikohdan farzandlar soni", '👶 Детей от второго брака')),
    F.splitDate('second_order_date', L('📅 Иккинчи суд буйруғи санаси', "📅 Ikkinchi sud buyrug‘i sanasi", '📅 Дата второго приказа'), {
      yearKey: 'second_order_year', monthKey: 'second_order_month', dayKey: 'second_order_day',
    }),
    F.share('second_alimony_share', L('📊 Иккинчи буйруғ улуши', "📊 Ikkinchi buyruq ulushi", '📊 Доля по второму приказу')),
    F.num('total_children_count', L('👨‍👩‍👧‍👦 Жами фарзандлар сони', "👨‍👩‍👧‍👦 Jami farzandlar soni", '👨‍👩‍👧‍👦 Всего детей')),
  ],
};

/* ============================================================ */
/* 5. Илтимоснома — рассмотреть дело в отсутствие истца           */

/**
 * Per-defendant FIO/address/phone/PINFL fields. The wizard asks each
 * defendant's set of 4 questions sequentially for as many defendants
 * as `defendants_count` indicates (capped at MAX_DEFENDANTS).
 */
const MAX_DEFENDANTS = 3;
function defendantFields(): FieldDef[] {
  const out: FieldDef[] = [];
  for (let i = 1; i <= MAX_DEFENDANTS; i++) {
    const idx = i;
    const skip = (v: Record<string, string>) =>
      Number(v.defendants_count ?? '0') < idx;
    out.push({
      ...F.fio(
        `defendant${idx}_fio`,
        L(
          `👤 ${idx}-жавобгар Ф.И.Ш.`,
          `👤 ${idx}-javobgar F.I.SH.`,
          `👤 Ответчик ${idx}: Ф.И.О.`,
        ),
      ),
      skipIf: skip,
      skipValue: '—',
    });
    out.push({
      ...F.address(
        `defendant${idx}_address`,
        L(
          `🏠 ${idx}-жавобгар манзили`,
          `🏠 ${idx}-javobgar manzili`,
          `🏠 Адрес ответчика ${idx}`,
        ),
      ),
      skipIf: skip,
      skipValue: '—',
    });
    out.push({
      ...F.phone(
        `defendant${idx}_phone`,
        L(
          `📱 ${idx}-жавобгар телефон`,
          `📱 ${idx}-javobgar telefon`,
          `📱 Телефон ответчика ${idx}`,
        ),
      ),
      skipIf: skip,
      skipValue: '—',
      defaultValue: '—',
    });
    out.push({
      ...F.pinfl(
        `defendant${idx}_pinfl`,
        L(
          `🆔 ${idx}-жавобгар ЖШШИР`,
          `🆔 ${idx}-javobgar JSHSHIR`,
          `🆔 ПИНФЛ ответчика ${idx}`,
        ),
      ),
      skipIf: skip,
      skipValue: '—',
      defaultValue: '—',
    });
  }
  return out;
}

const T_ILTIMOSNOMA: TemplateDef = {
  code: 'iltimosnoma-ishtiroksiz',
  category: 'iltimosnoma',
  title: L(
    '📨 Илтимоснома',
    '📨 Iltimosnoma',
    '📨 Ходатайство',
  ),
  subtitle: L(
    'даъвогарнинг иштирокисиз кўриш ҳақида',
    "da'vogarning ishtirokisiz ko‘rish haqida",
    'о рассмотрении дела в отсутствие истца',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `📨 <b>Илтимоснома — даъвогарнинг иштирокисиз ишни кўриш</b>\n\n📋 <b>Қачон бериш:</b>\nСизнинг номингиздан судда даъво иши кўрилаётган бўлса ва Сиз ёки вакилингиз шахсан суд мажлисига боролмаслигингиз мумкин бўлса. Илтимоснома орқали суддан ишни Сизнинг иштирокингизсиз кўришни ҳамда ҳал қилув қарорининг кўчирмасини юборишни сўрайсиз.\n\n📜 <b>Қонуний асос:</b>\nФПК 220-моддаси 4-қисми — тарафлар ишни ўз иштирокисиз кўришни илтимос қилишга ҳақли.\n\n🏛 <b>Қаерга:</b>\nИшингиз кўрилаётган туманлараро фуқаролик судига.\n\n📎 <b>Илова қилинадиган ҳужжатлар:</b>\n• Вакилнинг ишончномаси нусхаси (вакил орқали юборилса)\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар тури (юр.шахс ёки жисмоний шахс) → даъвогар маълумотлари → жавобгарлар сони ва маълумотлари → зарар тури, миқдори, почта харажати → вакил Ф.И.Ш. ва алоқа телефонлари.`,
    `📨 <b>Iltimosnoma — da'vogarning ishtirokisiz ishni ko‘rish</b>\n\n📋 <b>Qachon berish:</b>\nSizning nomingizdan sudda da'vo ishi ko‘rilayotgan bo‘lsa va Siz yoki vakilingiz shaxsan sud majlisiga borolmasligingiz mumkin bo‘lsa. Iltimosnoma orqali suddan ishni Sizning ishtirokingizsiz ko‘rishni hamda hal qilish qarorining ko‘chirmasini yuborishni so‘raysiz.\n\n📜 <b>Qonuniy asos:</b>\nFPK 220-moddasi 4-qismi — taraflar ishni o‘z ishtirokisiz ko‘rishni iltimos qilishga haqli.\n\n🏛 <b>Qayerga:</b>\nIshingiz ko‘rilayotgan tumanlararo fuqarolik sudiga.\n\n📎 <b>Ilova qilinadigan hujjatlar:</b>\n• Vakilning ishonchnomasi nusxasi (vakil orqali yuborilsa)\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar turi (yur.shaxs yoki jismoniy shaxs) → da'vogar ma'lumotlari → javobgarlar soni va ma'lumotlari → zarar turi, miqdori, pochta xarajati → vakil F.I.SH. va aloqa telefonlari.`,
    `📨 <b>Ходатайство — о рассмотрении дела в отсутствие истца</b>\n\n📋 <b>Когда подавать:</b>\nЕсли по Вашему иску в суде идёт процесс, а Вы или Ваш представитель не можете лично явиться в заседание. Ходатайством Вы просите суд рассмотреть дело без Вашего участия и направить копию решения.\n\n📜 <b>Правовое основание:</b>\nГПК ст. 220 ч. 4 — стороны вправе ходатайствовать о рассмотрении дела без их участия.\n\n🏛 <b>Куда:</b>\nВ межрайонный гражданский суд, где рассматривается дело.\n\n📎 <b>Документы:</b>\n• Копия доверенности представителя (если подаётся через представителя)\n\n📝 <b>Бот спросит:</b>\nТип истца (юр./физ. лицо) → данные истца → количество и данные ответчиков → характер ущерба, сумма, почтовые расходы → ФИО представителя и контактные телефоны.`,
  ),
  fileNameBase: 'iltimosnoma-ishtiroksiz',
  fields: [
    F.choice(
      'plaintiff_type',
      L(
        '🏷 Даъвогар тури',
        '🏷 Da’vogar turi',
        '🏷 Тип истца',
      ),
      [
        {
          value: '1',
          label: L(
            '🏢 Корхона / ташкилот',
            '🏢 Korxona / tashkilot',
            '🏢 Организация',
          ),
        },
        {
          value: '2',
          label: L(
            '👤 Жисмоний шахс',
            '👤 Jismoniy shaxs',
            '👤 Физлицо',
          ),
        },
      ],
    ),
    {
      ...F.text(
        'plaintiff_org_name',
        L(
          '🏢 Корхона/ташкилот номи',
          '🏢 Korxona/tashkilot nomi',
          '🏢 Название организации',
        ),
        L(
          'Масалан: Жиззах вилоят автомобиль йўллари бош бошқармаси',
          "Masalan: Jizzax viloyat avtomobil yo‘llari bosh boshqarmasi",
          'Например: Главное управление автомобильных дорог Жиззакской области',
        ),
      ),
      skipIf: (v) => v.plaintiff_type !== '1',
      skipValue: '—',
    },
    {
      ...F.fio(
        'plaintiff_fio',
        L(
          '👤 Даъвогар Ф.И.Ш.',
          '👤 Da’vogar F.I.SH.',
          '👤 Истец (Ф.И.О.)',
        ),
      ),
      skipIf: (v) => v.plaintiff_type !== '2',
      skipValue: '—',
    },
    F.address(
      'plaintiff_address',
      L(
        '🏠 Даъвогар манзили',
        '🏠 Da’vogar manzili',
        '🏠 Адрес истца',
      ),
    ),
    F.phone(
      'plaintiff_phone',
      L(
        '📱 Даъвогар телефони',
        '📱 Da’vogar telefoni',
        '📱 Телефон истца',
      ),
    ),
    {
      ...F.stir(
        'plaintiff_stir',
        L(
          '🔢 Корхона СТИРи',
          '🔢 Korxona STIRi',
          '🔢 СТИР организации',
        ),
      ),
      skipIf: (v) => v.plaintiff_type !== '1',
      skipValue: '—',
    },
    {
      ...F.pinfl(
        'plaintiff_pinfl',
        L(
          '🆔 Даъвогар ЖШШИРи',
          '🆔 Da’vogar JSHSHIRi',
          '🆔 ПИНФЛ истца',
        ),
      ),
      skipIf: (v) => v.plaintiff_type !== '2',
      skipValue: '—',
    },
    F.num(
      'defendants_count',
      L(
        `👥 Жавобгарлар сони (макс. ${MAX_DEFENDANTS})`,
        `👥 Javobgarlar soni (maks. ${MAX_DEFENDANTS})`,
        `👥 Количество ответчиков (макс. ${MAX_DEFENDANTS})`,
      ),
    ),
    ...defendantFields(),
    F.text(
      'damage_description',
      L(
        '💼 Зарар тури',
        '💼 Zarar turi',
        '💼 Характер ущерба',
      ),
      L(
        'Масалан: йўлга етказилган',
        "Masalan: yo‘lga yetkazilgan",
        'Например: дорожный',
      ),
    ),
    F.money(
      'damage_amount',
      L(
        '💰 Зарар миқдори (сўмда)',
        "💰 Zarar miqdori (so‘mda)",
        '💰 Сумма ущерба (в сумах)',
      ),
    ),
    F.money(
      'postal_expenses',
      L(
        '💌 Почта харажати (сўмда)',
        "💌 Pochta xarajati (so‘mda)",
        '💌 Почтовые расходы (в сумах)',
      ),
    ),
    F.fio(
      'representative_fio',
      L(
        '👤 Вакил Ф.И.Ш.',
        '👤 Vakil F.I.SH.',
        '👤 Ф.И.О. представителя',
      ),
    ),
    F.phone(
      'contact_phone1',
      L(
        '📱 Биринчи алоқа телефони',
        "📱 Birinchi aloqa telefoni",
        '📱 Контактный телефон 1',
      ),
    ),
    {
      ...F.phone(
        'contact_phone2',
        L(
          '📱 Иккинчи алоқа телефони (ихтиёрий)',
          "📱 Ikkinchi aloqa telefoni (ixtiyoriy)",
          '📱 Контактный телефон 2 (необязательно)',
        ),
      ),
      defaultValue: '—',
    },
  ],
};

/* ============================================================ */
/* 6. Даъво ариза — никоҳдан ажратиш (расторжение брака)         */

const T_NIKOH: TemplateDef = {
  code: 'davo-ariza-nikohdan-ajratish',
  category: 'davo_ariza',
  title: L(
    '💔 Никоҳдан ажратиш',
    '💔 Nikohdan ajratish',
    '💔 Расторжение брака',
  ),
  subtitle: L(
    'даъво ариза',
    "da'vo ariza",
    'исковое заявление',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `💔 <b>Никоҳдан ажратиш — даъво ариза</b>\n\n📋 <b>Қачон бериш:</b>\nЭр ёки хотиннинг бири никоҳни бекор қилишни талаб қилаётган бўлса (томонлардан биттаси розилик бермаганда — суд орқали). Оила Кодекси 40-41-моддалари.\n\n🏛 <b>Қаерга:</b>\nЖавобгарнинг яшаш жойи бўйича туманлараро фуқаролик суди (фарзанд даъвогар билан яшаётган бўлса — даъвогарнинг яшаш жойи бўйича ҳам мумкин).\n\n📎 <b>Илова қилинадиган ҳужжатлар:</b>\n• Паспорт нусхаси\n• Никоҳ гувоҳномаси асли\n• Фарзандлар туғилганлик гувоҳномаси нусхаси\n• МФЙ далолатномаси\n• Давлат божи квитанцияси\n• Почта харажати квитанцияси\n\n⏱ <b>Муддат:</b> 1-2 ой (тарафлар келишганда — қисқароқ; низо бўлса — 3 ой ва ундан кўп).\n\n💡 <b>Маслаҳат:</b>\nАризада тарихни қисқа, фактик ва ҳурматли ёзинг — судья ўқиб, ишни тушуниш керак. Бот овозли хабарни ҳам қабул қилади 🎙\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → жавобгар маълумотлари → никоҳ санаси ва ФХДЁ реквизитлари → фарзандлар сони ва туғилган саналари → қачондан буён бирга яшамайсиз → ажрашиш сабаблари (эркин тарзда).`,
    `💔 <b>Nikohdan ajratish — da'vo ariza</b>\n\n📋 <b>Qachon berish:</b>\nEr yoki xotinning biri nikohni bekor qilishni talab qilayotgan bo‘lsa (taraflardan biri rozilik bermaganda — sud orqali). Oila Kodeksi 40-41-moddalari.\n\n🏛 <b>Qayerga:</b>\nJavobgarning yashash joyi bo‘yicha tumanlararo fuqarolik sudi (farzand da'vogar bilan yashayotgan bo‘lsa — da'vogarning yashash joyi bo‘yicha ham mumkin).\n\n📎 <b>Ilova qilinadigan hujjatlar:</b>\n• Pasport nusxasi\n• Nikoh guvohnomasi asli\n• Farzandlar tug‘ilganlik guvohnomasi nusxasi\n• MFY dalolatnomasi\n• Davlat boji kvitansiyasi\n• Pochta xarajati kvitansiyasi\n\n⏱ <b>Muddat:</b> 1-2 oy (taraflar kelishganda — qisqaroq; nizo bo‘lsa — 3 oy va undan ko‘p).\n\n💡 <b>Maslahat:</b>\nArizada tarixni qisqa, faktik va hurmatli yozing — sudya o‘qib, ishni tushunishi kerak. Bot ovozli xabarni ham qabul qiladi 🎙\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → javobgar ma'lumotlari → nikoh sanasi va FXDYO rekvizitlari → farzandlar soni va tug‘ilgan sanalari → qachondan buyon birga yashamaysiz → ajrashish sabablari (erkin tarzda).`,
    `💔 <b>Расторжение брака — исковое заявление</b>\n\n📋 <b>Когда подавать:</b>\nКогда один из супругов хочет развестись, а другой не даёт согласия (или есть несовершеннолетние дети) — нужен судебный порядок. Семейный кодекс ст. 40-41.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства ответчика (если ребёнок живёт с истцом — можно по месту истца).\n\n📎 <b>Документы для приложения:</b>\n• Копия паспорта\n• Оригинал свидетельства о браке\n• Копии свидетельств о рождении детей\n• Справка из махалли\n• Квитанция гос. пошлины\n• Квитанция почтовых расходов\n\n⏱ <b>Срок рассмотрения:</b> 1-2 месяца (по согласию сторон — быстрее; при споре — 3 месяца и больше).\n\n💡 <b>Совет:</b>\nИзложите ситуацию коротко, по фактам и уважительно — судье нужно понять суть. Бот принимает голосовые сообщения 🎙\n\n📝 <b>Бот спросит:</b>\nваши данные → данные ответчика → дата брака и реквизиты ФХДЁ → количество и даты рождения детей → когда начали жить раздельно → причины развода (свободный текст).`,
  ),
  fileNameBase: 'davo-ariza-nikohdan-ajratish',
  fields: [
    F.fio('plaintiff_fio', L('👤 Даъвогар Ф.И.Ш.', '👤 Da’vogar F.I.SH.', '👤 Истец (Ф.И.О.)')),
    F.address('plaintiff_address', L('🏠 Даъвогар манзили', '🏠 Da’vogar manzili', '🏠 Адрес истца')),
    F.phone('plaintiff_phone', L('📱 Даъвогар телефон', '📱 Da’vogar telefon', '📱 Телефон истца')),
    F.fio('defendant_fio', L('👤 Жавобгар Ф.И.Ш.', '👤 Javobgar F.I.SH.', '👤 Ответчик (Ф.И.О.)')),
    F.address('defendant_address', L('🏠 Жавобгар манзили', '🏠 Javobgar manzili', '🏠 Адрес ответчика')),
    F.phone('defendant_phone', L('📱 Жавобгар телефон', '📱 Javobgar telefon', '📱 Телефон ответчика')),
    F.splitDate(
      'marriage_date',
      L('💒 Никоҳ санаси', '💒 Nikoh sanasi', '💒 Дата брака'),
      { yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day' },
    ),
    F.text(
      'marriage_registry_office',
      L(
        '🏛 ФХДЁ бўлими (никоҳ қайд этилган жой)',
        '🏛 FXDYO bo‘limi (nikoh qayd etilgan joy)',
        '🏛 Орган ЗАГС (где зарегистрирован брак)',
      ),
      L(
        'Масалан: Сирдарё туман 2-сонли',
        "Masalan: Sirdaryo tuman 2-sonli",
        'Например: Сырдарьинский район №2',
      ),
    ),
    F.text(
      'marriage_act_number',
      L(
        '🔢 Никоҳ гувоҳномаси рақами',
        '🔢 Nikoh guvohnomasi raqami',
        '🔢 Номер свидетельства о браке',
      ),
      L(
        'Масалан: 2-1219-22-00248',
        "Masalan: 2-1219-22-00248",
        'Например: 2-1219-22-00248',
      ),
    ),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    {
      key: 'separation_date',
      validator: 'year-month',
      splitYearMonth: { yearKey: 'separation_year', monthKey: 'separation_month' },
      label: L('💔 Қачондан буён бирга яшамаяпсиз', "💔 Qachondan buyon birga yashamayapsiz", '💔 С какого момента живёте отдельно'),
      hint: L('Календардан йил ва ойни танланг', 'Kalendardan yil va oyni tanlang', 'Выберите год и месяц из календаря'),
    },
    F.multiline(
      'divorce_reasons',
      L(
        '📝 Ажрашиш сабаблари',
        "📝 Ajrashish sabablari",
        '📝 Причины развода',
      ),
      L(
        'Қисқа, фактик ёзинг: турмушни нима учун давом эттириб бўлмаслигини. Ҳақоратлар, хиёнат, моддий низо, ота-онага муносабат — нима бўлганини ёзинг. Овозли хабар ҳам мумкин 🎙',
        "Qisqa, faktik yozing: turmushni nima uchun davom ettirib bo‘lmasligini. Haqoratlar, xiyonat, moddiy nizo, ota-onaga munosabat — nima bo‘lganini yozing. Ovozli xabar ham mumkin 🎙",
        'Коротко и по фактам: почему дальнейшая совместная жизнь невозможна. Оскорбления, измена, материальный конфликт, отношение к родителям — что произошло. Можно голосовым 🎙',
      ),
    ),
  ],
};

/* ============================================================
 * Shared helpers for the family / civil-suit templates below.
 * Most of them ask for the same plaintiff + defendant block at
 * the top, then one or two case-specific fields, then a free-form
 * "circumstances" multiline. The helpers reduce the boilerplate.
 * ============================================================ */

const PLAINTIFF_BLOCK: FieldDef[] = [
  F.fio('plaintiff_fio', L('👤 Даъвогар Ф.И.Ш.', '👤 Da’vogar F.I.SH.', '👤 Истец (Ф.И.О.)')),
  F.address('plaintiff_address', L('🏠 Даъвогар манзили', '🏠 Da’vogar manzili', '🏠 Адрес истца')),
  F.phone('plaintiff_phone', L('📱 Даъвогар телефон', '📱 Da’vogar telefon', '📱 Телефон истца')),
];

const DEFENDANT_BLOCK: FieldDef[] = [
  F.fio('defendant_fio', L('👤 Жавобгар Ф.И.Ш.', '👤 Javobgar F.I.SH.', '👤 Ответчик (Ф.И.О.)')),
  F.address('defendant_address', L('🏠 Жавобгар манзили', '🏠 Javobgar manzili', '🏠 Адрес ответчика')),
  F.phone('defendant_phone', L('📱 Жавобгар телефон', '📱 Javobgar telefon', '📱 Телефон ответчика')),
];

const APPLICANT_BLOCK: FieldDef[] = [
  F.fio('plaintiff_fio', L('👤 Аризачи Ф.И.Ш.', '👤 Arizachi F.I.SH.', '👤 Заявитель (Ф.И.О.)')),
  F.address('plaintiff_address', L('🏠 Аризачи манзили', '🏠 Arizachi manzili', '🏠 Адрес заявителя')),
  F.phone('plaintiff_phone', L('📱 Аризачи телефон', '📱 Arizachi telefon', '📱 Телефон заявителя')),
];

const SEPARATION_DATE_FIELD: FieldDef = {
  key: 'separation_date',
  validator: 'year-month',
  splitYearMonth: { yearKey: 'separation_year', monthKey: 'separation_month' },
  label: L(
    '💔 Қачондан буён бирга яшамаяпсиз',
    "💔 Qachondan buyon birga yashamayapsiz",
    '💔 С какого момента живёте отдельно',
  ),
  hint: L('Календардан йил ва ойни танланг', 'Kalendardan yil va oyni tanlang', 'Выберите год и месяц из календаря'),
};

const NARRATIVE = (
  key: string,
  label: Record<Locale, string>,
  hintLabel: Record<Locale, string>,
): FieldDef =>
  F.multiline(
    key,
    label,
    L(
      `${hintLabel.uz_cyrillic} Қисқа, фактик, ҳурматли тилда ёзинг. Овозли хабар ҳам мумкин 🎙`,
      `${hintLabel.uz_latin} Qisqa, faktik, hurmatli tilda yozing. Ovozli xabar ham mumkin 🎙`,
      `${hintLabel.ru} Коротко, по фактам, в уважительном тоне. Можно голосовым 🎙`,
    ),
  );

/* ============================================================
 * 7. Оталикни белгилаш + алимент ундириш (paternity + alimony)
 * ============================================================ */
const T_OTALIK: TemplateDef = {
  code: 'davo-ariza-otalik-aliment',
  category: 'davo_ariza',
  title: L('👶 Оталикни белгилаш', '👶 Otalikni belgilash', '👶 Установление отцовства'),
  subtitle: L(
    'ва алимент ундириш',
    "va aliment undirish",
    '+ взыскание алиментов',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `👶 <b>Оталикни белгилаш ва алимент ундириш</b>\n\n📋 <b>Қачон бериш:</b>\nҚонуний никоҳсиз туғилган боланинг отаси оталикни эътироф этмаса. Иккита масала бирваракай: оталикни белгилаш + алимент ундириш.\n\n🏛 <b>Қаерга:</b>\nЖавобгарнинг (фараз қилинаётган ота) яшаш жойи бўйича туманлараро фуқаролик суди.\n\n📎 <b>Ҳужжатлар:</b>\n• Паспорт нусхаси\n• Боланинг туғилганлик гувоҳномаси\n• МФЙ далолатномаси (бирга яшаганлик)\n• Фотолар, ёзишмалар, гувоҳлар\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар ва жавобгар маълумотлари → шаърий никоҳ йили → бола маълумотлари → бирга яшаган жой → ҳолатлар (эркин).`,
    `👶 <b>Otalikni belgilash va aliment undirish</b>\n\n📋 <b>Qachon berish:</b>\nQonuniy nikohsiz tug‘ilgan bolaning otasi otalikni e'tirof etmasa. Ikkita masala birvarakay: otalikni belgilash + aliment undirish.\n\n🏛 <b>Qayerga:</b>\nJavobgarning (faraz qilinayotgan ota) yashash joyi bo‘yicha tumanlararo fuqarolik sudi.\n\n📎 <b>Hujjatlar:</b>\n• Pasport nusxasi\n• Bolaning tug‘ilganlik guvohnomasi\n• MFY dalolatnomasi (birga yashaganlik)\n• Fotolar, yozishmalar, guvohlar\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar va javobgar ma'lumotlari → shariy nikoh yili → bola ma'lumotlari → birga yashagan joy → holatlar (erkin).`,
    `👶 <b>Установление отцовства + взыскание алиментов</b>\n\n📋 <b>Когда подавать:</b>\nЕсли ребёнок рождён вне зарегистрированного брака, а отец не признаёт отцовство. Два вопроса сразу: установление отцовства + алименты.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства ответчика (предполагаемого отца).\n\n📎 <b>Документы:</b>\n• Копия паспорта\n• Свидетельство о рождении ребёнка\n• Справка из махалли (о совместном проживании)\n• Фото, переписка, показания свидетелей\n\n📝 <b>Бот спросит:</b>\nданные истца и ответчика → год шариатского брака → данные ребёнка → место совместного проживания → обстоятельства (свободно).`,
  ),
  fileNameBase: 'davo-ariza-otalik-aliment',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    F.year('shariy_marriage_year', L('💍 Шаърий никоҳ йили', '💍 Shariy nikoh yili', '💍 Год шариатского брака')),
    F.fio('child_fio', L('👶 Бола Ф.И.Ш.', '👶 Bola F.I.SH.', '👶 Ф.И.О. ребёнка')),
    F.splitDate('child_dob', L('🎂 Бола туғилган санаси', "🎂 Bola tug‘ilgan sanasi", '🎂 Дата рождения ребёнка'), {
      yearKey: 'child_year', monthKey: 'child_month', dayKey: 'child_day',
    }),
    F.text('cohabitation_address', L(
      '🏠 Бирга яшаган жой (манзил)',
      '🏠 Birga yashagan joy (manzil)',
      '🏠 Адрес совместного проживания',
    ), L(
      'Масалан: Жиззах шаҳар, Боғизор маҳалласи, Аброр кўчаси, 90-уй',
      "Masalan: Jizzax shahar, Bog‘izor mahallasi, Abror ko‘chasi, 90-uy",
      'Например: г. Жиззак, махалля Богизор, ул. Аброр, 90',
    )),
    NARRATIVE(
      'paternity_reasons',
      L('📝 Ҳолатлар', '📝 Holatlar', '📝 Обстоятельства'),
      L('Оталикни тан олмаслик, нима учун судга мурожаат қилаяпсиз.', "Otalikni tan olmaslik, nima uchun sudga murojaat qilayapsiz.", 'Почему обращаетесь в суд: ответчик не признаёт отцовство, и т.п.'),
    ),
  ],
};

/* ============================================================
 * 8. Болани олиш (custody)
 * ============================================================ */
const T_BOLA_OLISH: TemplateDef = {
  code: 'davo-ariza-bolani-olish',
  category: 'davo_ariza',
  title: L('👨‍👧 Болани олиш', '👨‍👧 Bolani olish', '👨‍👧 Передача ребёнка'),
  subtitle: L('тарбияга олиш', 'tarbiyaga olish', 'передача на воспитание'),
  description: L('—', '—', '—'),
  instructions: L(
    `👨‍👧 <b>Болани олиш (тарбияга бериш)</b>\n\n📋 <b>Қачон бериш:</b>\nЭр-хотин ажрашгандан сўнг бола қайси отаона билан қолиши бўйича низо чиққан бўлса. Болалар манфаатини ҳимоя қилиш.\n\n🏛 <b>Қаерга:</b>\nЖавобгарнинг ёки бола яшайдиган жой бўйича туманлараро фуқаролик суди.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар ва жавобгар → никоҳ ва туғилган сана → бола маълумотлари → қачондан буён ажралганлар → сабаблар.`,
    `👨‍👧 <b>Bolani olish (tarbiyaga berish)</b>\n\n📋 <b>Qachon berish:</b>\nEr-xotin ajrashgandan so‘ng bola qaysi ota-ona bilan qolishi bo‘yicha nizo chiqqan bo‘lsa.\n\n🏛 <b>Qayerga:</b>\nJavobgarning yoki bola yashaydigan joy bo‘yicha tumanlararo fuqarolik sudi.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar va javobgar → nikoh va tug‘ilgan sana → bola ma'lumotlari → qachondan buyon ajralganlar → sabablar.`,
    `👨‍👧 <b>Передача ребёнка на воспитание</b>\n\n📋 <b>Когда подавать:</b>\nКогда после развода возник спор о том, с кем из родителей будет жить ребёнок.\n\n🏛 <b>Куда:</b>\nМежрайонный гражданский суд по месту жительства ответчика или ребёнка.\n\n📝 <b>Бот спросит:</b>\nистец и ответчик → дата брака и развода → данные ребёнка → причины.`,
  ),
  fileNameBase: 'davo-ariza-bolani-olish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    F.splitDate('marriage_date', L('💒 Никоҳ санаси', '💒 Nikoh sanasi', '💒 Дата брака'), {
      yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day',
    }),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    F.fio('requested_child_fio', L(
      '👶 Тарбига олинаётган бола Ф.И.Ш.',
      "👶 Tarbiyaga olinayotgan bola F.I.SH.",
      '👶 Ф.И.О. ребёнка (на воспитание)',
    )),
    F.splitDate('requested_child_dob', L(
      '🎂 Боланинг туғилган санаси',
      "🎂 Bolaning tug‘ilgan sanasi",
      '🎂 Дата рождения ребёнка',
    ), {
      yearKey: 'requested_child_year', monthKey: 'requested_child_month', dayKey: 'requested_child_day',
    }),
    SEPARATION_DATE_FIELD,
    NARRATIVE(
      'custody_reasons',
      L('📝 Болани олиш сабаблари', "📝 Bolani olish sabablari", '📝 Причины передачи ребёнка'),
      L('Нима учун бола сиз билан қолиши керак.', "Nima uchun bola siz bilan qolishi kerak.", 'Почему ребёнок должен остаться с вами.'),
    ),
  ],
};

/* ============================================================
 * 9. Уй-жойга киритиш (housing entry)
 * ============================================================ */
const T_UY_KIRITISH: TemplateDef = {
  code: 'davo-ariza-uy-kiritish',
  category: 'davo_ariza',
  title: L('🏠 Уй-жойга киритиш', '🏠 Uy-joyga kiritish', '🏠 Допуск в жилище'),
  subtitle: L('эр оиласи уйига', 'er oilasi uyiga', 'в дом семьи мужа'),
  description: L('—', '—', '—'),
  instructions: L(
    `🏠 <b>Уй-жойга киритиш</b>\n\n📋 <b>Қачон бериш:</b>\nКелин бўлиб тушган уйдан ҳайдалган ёки кириш мумкин эмаслигида. Бола билан бирга яшаш жойи бўлмаса.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар ва жавобгар → никоҳ санаси → фарзандлар маълумотлари → уйдан чиқиб кетиш сабаблари → манзил (қаерга киритиш керак).`,
    `🏠 <b>Uy-joyga kiritish</b>\n\n📋 <b>Qachon berish:</b>\nKelin bo‘lib tushgan uydan haydalgan yoki kirishga ruxsat berilmaganda. Bola bilan birga yashash joyi bo‘lmasa.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar va javobgar → nikoh sanasi → farzandlar ma'lumotlari → uydan chiqib ketish sabablari → manzil.`,
    `🏠 <b>Допуск в жилище</b>\n\n📋 <b>Когда подавать:</b>\nКогда невестку (или жену) не пускают в дом семьи мужа, а другого жилья у неё с детьми нет.\n\n📝 <b>Бот спросит:</b>\nистец и ответчик → дата брака → дети → причины ухода → адрес дома.`,
  ),
  fileNameBase: 'davo-ariza-uy-kiritish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    F.splitDate('marriage_date', L('💒 Никоҳ санаси', '💒 Nikoh sanasi', '💒 Дата брака'), {
      yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day',
    }),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    F.text('housing_address', L(
      '🏠 Киритиш керак бўлган уй манзили',
      "🏠 Kirish kerak bo‘lgan uy manzili",
      '🏠 Адрес дома (куда впустить)',
    ), L(
      'Масалан: Жиззах шаҳар, Лолазор маҳалласи, Лолазор кўчаси, 23-уй',
      "Masalan: Jizzax shahar, Lolazor mahallasi, Lolazor ko‘chasi, 23-uy",
      'Например: г. Жиззак, ул. Лолазор, 23',
    )),
    NARRATIVE(
      'leaving_reasons',
      L('📝 Уйдан чиқиб кетиш сабаблари', "📝 Uydan chiqib ketish sabablari", '📝 Причины ухода из дома'),
      L('Нима учун уйдан чиқиб кетдингиз ва нима учун қайтиб кириш керак.', "Nima uchun uydan chiqib ketdingiz va nima uchun qaytib kirish kerak.", 'Почему пришлось уйти и почему нужно вернуться.'),
    ),
  ],
};

/* ============================================================
 * 10. Уй-жойдан кўчириш (eviction)
 * ============================================================ */
const T_KOCHIRISH: TemplateDef = {
  code: 'davo-ariza-uy-kochirish',
  category: 'davo_ariza',
  title: L('🚪 Уй-жойдан кўчириш', '🚪 Uy-joydan ko‘chirish', '🚪 Выселение из жилища'),
  subtitle: L('собственник арзимаганини', "egasi bo‘lganligi uchun", 'как собственник'),
  description: L('—', '—', '—'),
  instructions: L(
    `🚪 <b>Уй-жойдан кўчириш</b>\n\n📋 <b>Қачон бериш:</b>\nСиз нотариал шартнома орқали уйни сотиб олдингиз, ҳозирги яшовчилар уйни бўшатишни истамайдилар.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар ва жавобгар → нотариус Ф.И.Ш. → шартнома санаси ва рақами → давлат рўйхати рақами → уй манзили.`,
    `🚪 <b>Uy-joydan ko‘chirish</b>\n\n📋 <b>Qachon berish:</b>\nSiz notarial shartnoma orqali uyni sotib oldingiz, hozirgi yashovchilar uyni bo‘shatishni xohlamaydilar.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar va javobgar → notarius F.I.SH. → shartnoma sanasi va raqami → davlat ro‘yxati raqami → uy manzili.`,
    `🚪 <b>Выселение из жилища</b>\n\n📋 <b>Когда подавать:</b>\nВы купили жильё по нотариальному договору, текущие жильцы не хотят освобождать.\n\n📝 <b>Бот спросит:</b>\nистец и ответчик → ФИО нотариуса → дата и номер договора → номер госрегистрации → адрес.`,
  ),
  fileNameBase: 'davo-ariza-uy-kochirish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    F.fio('notary_fio', L('👨‍⚖️ Нотариус Ф.И.Ш.', '👨‍⚖️ Notarius F.I.SH.', '👨‍⚖️ ФИО нотариуса')),
    F.splitDate('contract_date', L('📅 Шартнома санаси', "📅 Shartnoma sanasi", '📅 Дата договора'), {
      yearKey: 'contract_year', monthKey: 'contract_month', dayKey: 'contract_day',
    }),
    F.text('contract_number', L('🔢 Реестр рақами', "🔢 Reyestr raqami", '🔢 Реестровый номер'),
      L('Масалан: 000012345', "Masalan: 000012345", 'Например: 000012345')),
    F.text('cadastre_number', L('🏛 Давлат рўйхати рақами', "🏛 Davlat ro‘yxati raqami", '🏛 Номер госрегистрации'),
      L('Масалан: 00006789', "Masalan: 00006789", 'Например: 00006789')),
    F.text('property_address', L(
      '🏠 Уй манзили',
      "🏠 Uy manzili",
      '🏠 Адрес жилья',
    ), L(
      'Масалан: Шароф Рашидов тумани, Янгикўрғон МФЙ, Узун кўчаси, 99-уй',
      "Masalan: Sharof Rashidov tumani, Yangiko‘rg‘on MFY, Uzun ko‘chasi, 99-uy",
      'Например: Шараф Рашидовский р-н, Янгикурганская МФЙ, ул. Узун, 99',
    )),
  ],
};

/* ============================================================
 * 11. Мол-мулкни олиб бериш (property recovery from spouse)
 * ============================================================ */
const T_MOL_MULK: TemplateDef = {
  code: 'davo-ariza-mol-mulkni-olish',
  category: 'davo_ariza',
  title: L('📦 Мол-мулкни олиб бериш', "📦 Mol-mulkni olib berish", '📦 Возврат имущества'),
  subtitle: L('шахсий мол-мулк', "shaxsiy mol-mulk", 'личного имущества'),
  description: L('—', '—', '—'),
  instructions: L(
    `📦 <b>Мол-мулкни олиб бериш</b>\n\n📋 <b>Қачон бериш:</b>\nАлоҳида яшай бошлаганда жавобгар сизга тегишли шахсий мол-мулкингизни бермайди.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар, жавобгар → никоҳ санаси → фарзандлар → мол-мулклар рўйхати.`,
    `📦 <b>Mol-mulkni olib berish</b>\n\n📋 <b>Qachon berish:</b>\nAlohida yashay boshlaganda javobgar sizga tegishli shaxsiy mol-mulkingizni bermaydi.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar, javobgar → nikoh sanasi → farzandlar → mol-mulklar ro‘yxati.`,
    `📦 <b>Возврат личного имущества</b>\n\n📋 <b>Когда подавать:</b>\nПосле раздельного проживания ответчик отказывается отдать ваше личное имущество.\n\n📝 <b>Бот спросит:</b>\nистец, ответчик → дата брака → дети → список имущества.`,
  ),
  fileNameBase: 'davo-ariza-mol-mulkni-olish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    F.splitDate('marriage_date', L('💒 Никоҳ санаси', '💒 Nikoh sanasi', '💒 Дата брака'), {
      yearKey: 'marriage_year', monthKey: 'marriage_month', dayKey: 'marriage_day',
    }),
    F.num('children_count', L('👶 Фарзандлар сони', "👶 Farzandlar soni", '👶 Количество детей')),
    ...childFields(),
    NARRATIVE(
      'property_list',
      L('📦 Мол-мулклар рўйхати', "📦 Mol-mulklar ro‘yxati", '📦 Список имущества'),
      L('Ҳар бирини алоҳида қаторда: ном, миқдор, бозор баҳоси.', "Har birini alohida qatorda: nom, miqdor, bozor bahosi.", 'Каждый предмет на отдельной строке: название, количество, рыночная цена.'),
    ),
  ],
};

/* ============================================================
 * 12. Қарз ундириш — с тилхатом (debt with written note)
 * ============================================================ */
const T_QARZ: TemplateDef = {
  code: 'davo-ariza-qarz-undirish',
  category: 'davo_ariza',
  title: L('💵 Қарз ундириш', '💵 Qarz undirish', '💵 Взыскание долга'),
  subtitle: L('тилхат асосида', 'tilxat asosida', 'по расписке'),
  description: L('—', '—', '—'),
  instructions: L(
    `💵 <b>Қарз ундириш (тилхат асосида)</b>\n\n📋 <b>Қачон бериш:</b>\nҚарзга пул берганингизни тилхат тасдиқлайди, лекин жавобгар муддатида қайтарилмаяпти.\n\n💡 Давлат божи: қарз суммасининг 4% миқдорида.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар, жавобгар → қарз олинган сана ва миқдор → тилхат бўйича қайтариш муддати → қўшимча ҳолатлар.`,
    `💵 <b>Qarz undirish (tilxat asosida)</b>\n\n📋 <b>Qachon berish:</b>\nQarzga pul berganingizni tilxat tasdiqlaydi, lekin javobgar muddatida qaytarmayapti.\n\n💡 Davlat boji: qarz summasining 4% miqdorida.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar, javobgar → qarz olingan sana va miqdor → tilxat bo‘yicha qaytarish muddati → qo‘shimcha holatlar.`,
    `💵 <b>Взыскание долга по расписке</b>\n\n📋 <b>Когда подавать:</b>\nВы дали в долг под расписку, ответчик не возвращает в срок.\n\n💡 Госпошлина: 4% от суммы долга.\n\n📝 <b>Бот спросит:</b>\nистец, ответчик → дата и сумма займа → срок возврата по расписке → дополнительные обстоятельства.`,
  ),
  fileNameBase: 'davo-ariza-qarz-undirish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    {
      key: 'debt_date',
      validator: 'year-month',
      splitYearMonth: { yearKey: 'debt_year', monthKey: 'debt_month' },
      label: L('📅 Қарз олинган сана (йил+ой)', "📅 Qarz olingan sana (yil+oy)", '📅 Когда взяли в долг (год+месяц)'),
      hint: L('Календардан танланг', 'Kalendardan tanlang', 'Выберите из календаря'),
    },
    F.money('debt_amount', L('💰 Қарз миқдори (сўмда)', "💰 Qarz miqdori (so‘mda)", '💰 Сумма долга (в сумах)')),
    F.text('repayment_period', L(
      '⏱ Қайтариш муддати',
      "⏱ Qaytarish muddati",
      '⏱ Срок возврата',
    ), L(
      'Масалан: 3 ой, 1 йил, 30 кун',
      "Masalan: 3 oy, 1 yil, 30 kun",
      'Например: 3 месяца, 1 год, 30 дней',
    )),
    NARRATIVE(
      'debt_circumstances',
      L('📝 Қўшимча ҳолатлар', "📝 Qo‘shimcha holatlar", '📝 Дополнительные обстоятельства'),
      L('Қачон қайтарилиши керак эди, неча марта илтимос қилдингиз.', "Qachon qaytarilishi kerak edi, necha marta iltimos qildingiz.", 'Когда должны были вернуть, сколько раз просили.'),
    ),
  ],
};

/* ============================================================
 * 13. Пул(қарз) ундириш — алдов, ИИБ қарори (money - fraud)
 * ============================================================ */
const T_PUL: TemplateDef = {
  code: 'davo-ariza-pul-undirish',
  category: 'davo_ariza',
  title: L('💸 Пул(қарз) ундириш', "💸 Pul(qarz) undirish", '💸 Взыскание (алдов)'),
  subtitle: L('ИИБ қарорига асосан', "IIB qaroriga asosan", 'на основании постановления ОВД'),
  description: L('—', '—', '—'),
  instructions: L(
    `💸 <b>Пул(қарз) ундириш — алдов ҳолати</b>\n\n📋 <b>Қачон бериш:</b>\nЖавобгар сизни алдаб товар/пул олиб қочди. ИИБга мурожаат қилдингиз, ИИБ жиноят иши қўзғатишни рад қилди — энди фуқаролик суди орқали.\n\n📝 <b>Бот сўрайди:</b>\nДаъвогар, жавобгар → қарз олинган сана, миқдор → товар тури → ИИБ қарори санаси ва тафсилотлари.`,
    `💸 <b>Pul(qarz) undirish — aldov holati</b>\n\n📋 <b>Qachon berish:</b>\nJavobgar sizni aldab tovar/pul olib qochdi. IIBga murojaat qildingiz, IIB jinoyat ishi qo‘zg‘atishni rad qildi — endi fuqarolik sudi orqali.\n\n📝 <b>Bot so‘raydi:</b>\nDa'vogar, javobgar → qarz olingan sana, miqdor → tovar turi → IIB qarori sanasi va tafsilotlari.`,
    `💸 <b>Взыскание (мошенничество)</b>\n\n📋 <b>Когда подавать:</b>\nОтветчик обманом получил у вас товар/деньги. Вы обратились в ОВД, отказ в возбуждении уг.дела — теперь через гражданский суд.\n\n📝 <b>Бот спросит:</b>\nистец, ответчик → дата и сумма займа → тип товара → дата постановления ОВД и обстоятельства.`,
  ),
  fileNameBase: 'davo-ariza-pul-undirish',
  fields: [
    ...PLAINTIFF_BLOCK,
    ...DEFENDANT_BLOCK,
    {
      key: 'debt_date',
      validator: 'year-month',
      splitYearMonth: { yearKey: 'debt_year', monthKey: 'debt_month' },
      label: L('📅 Қарз олинган сана (йил+ой)', "📅 Qarz olingan sana (yil+oy)", '📅 Когда взято в долг (год+месяц)'),
      hint: L('Календардан танланг', 'Kalendardan tanlang', 'Выберите из календаря'),
    },
    F.money('debt_amount', L('💰 Жами қарз миқдори (сўмда)', "💰 Jami qarz miqdori (so‘mda)", '💰 Сумма долга (в сумах)')),
    F.text('debt_goods', L(
      '📦 Товар тури',
      "📦 Tovar turi",
      '📦 Тип товара/имущества',
    ), L(
      'Масалан: озиқ-овқат, рўзғор техникаси',
      "Masalan: oziq-ovqat, ro‘zg‘or texnikasi",
      'Например: продукты, бытовая техника',
    )),
    NARRATIVE(
      'iib_details',
      L('📝 ИИБ қарори ва ҳолатлар', "📝 IIB qarori va holatlar", '📝 Постановление ОВД и обстоятельства'),
      L('ИИБ қарори санаси, рад этилиш сабаби, жавобгарнинг тушунтириши.', "IIB qarori sanasi, rad etilish sababi, javobgarning tushuntirishi.", 'Дата постановления ОВД, причина отказа, объяснения ответчика.'),
    ),
  ],
};

/* ============================================================
 * 14. Иш ҳужжатларидан нусхалар олиш (request copies)
 * ============================================================ */
const T_NUSHA: TemplateDef = {
  code: 'ariza-hujjatdan-nuskha',
  category: 'ariza',
  title: L('📑 Иш ҳужжатларидан нусхалар', "📑 Ish hujjatlaridan nusxalar", '📑 Копии материалов дела'),
  subtitle: L('олиш ҳақида', "olish haqida", 'получить'),
  description: L('—', '—', '—'),
  instructions: L(
    `📑 <b>Иш ҳужжатларидан нусхалар олиш</b>\n\n📋 <b>Қачон бериш:</b>\nСиз кўрилган суд ишида тараф (даъвогар ёки жавобгар) бўлгансиз, иш материалларидан нусхалар керак.\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → суд қарори санаси → иш бўйича даъвогар ва жавобгар → иш рақами → нима керак (эркин).`,
    `📑 <b>Ish hujjatlaridan nusxalar olish</b>\n\n📋 <b>Qachon berish:</b>\nSiz ko‘rilgan sud ishida taraf (da'vogar yoki javobgar) bo‘lgansiz, ish materiallaridan nusxalar kerak.\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → sud qarori sanasi → ish bo‘yicha da'vogar va javobgar → ish raqami → nima kerak.`,
    `📑 <b>Запрос копий материалов дела</b>\n\n📋 <b>Когда подавать:</b>\nВы были стороной (истцом или ответчиком) по рассмотренному делу, нужны копии материалов.\n\n📝 <b>Бот спросит:</b>\nданные заявителя → дата решения → стороны по делу → номер дела → что именно нужно.`,
  ),
  fileNameBase: 'ariza-hujjatdan-nuskha',
  fields: [
    ...APPLICANT_BLOCK,
    F.splitDate('case_ruling_date', L('📅 Суд қарори санаси', "📅 Sud qarori sanasi", '📅 Дата судебного решения'), {
      yearKey: 'case_year', monthKey: 'case_month', dayKey: 'case_day',
    }),
    F.fio('case_plaintiff_fio', L('👤 Иш бўйича даъвогар', "👤 Ish bo‘yicha da'vogar", '👤 Истец по делу')),
    F.fio('case_defendant_fio', L('👤 Иш бўйича жавобгар', "👤 Ish bo‘yicha javobgar", '👤 Ответчик по делу')),
    F.text('case_subject', L(
      '⚖️ Иш мазмуни',
      "⚖️ Ish mazmuni",
      '⚖️ Предмет дела',
    ), L(
      'Масалан: алимент ундириш, никоҳдан ажратиш',
      "Masalan: aliment undirish, nikohdan ajratish",
      'Например: взыскание алиментов, расторжение брака',
    )),
    F.text('case_number', L(
      '🔢 Иш рақами',
      "🔢 Ish raqami",
      '🔢 Номер дела',
    ), L(
      'Масалан: 2-1301-2X01/XXXX',
      "Masalan: 2-1301-2X01/XXXX",
      'Например: 2-1301-2X01/XXXX',
    )),
    F.choice('party_role', L(
      '👥 Иш бўйича Сиз кимсиз',
      "👥 Ish bo‘yicha Siz kimsiz",
      '👥 Ваша роль в деле',
    ), [
      { value: '1', label: L('Даъвогар', "Da'vogar", 'Истец') },
      { value: '2', label: L('Жавобгар', 'Javobgar', 'Ответчик') },
    ]),
    NARRATIVE(
      'copy_request',
      L('📝 Қайси ҳужжатлар керак', "📝 Qaysi hujjatlar kerak", '📝 Какие документы нужны'),
      L('Ҳужжатлар номини рўйхат қилинг: ҳал қилув қарори, иш материаллари ва ҳ.к.', "Hujjatlar nomini ro‘yxat qiling: hal qilish qarori, ish materiallari va h.k.", 'Перечислите: решение суда, материалы дела и т.д.'),
    ),
  ],
};

/* ============================================================
 * 14b. JINOYAT — нусха олиш (criminal court: request verdict copy)
 * ============================================================ */
const T_JIN_NUSHA: TemplateDef = {
  code: 'ariza-jinoyat-nuskha',
  category: 'ariza',
  courtTypeCode: 'jinoyat',
  title: L(
    '📑 Суд ҳукми нусхаси',
    '📑 Sud hukmi nusxasi',
    '📑 Копия приговора',
  ),
  subtitle: L(
    'жиноят/маъмурий иш бўйича',
    "jinoyat/ma'muriy ish bo‘yicha",
    'по уголовному/административному делу',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `📑 <b>Суд ҳукми ва иш ҳужжатларидан нусхалар олиш</b>\n\n📋 <b>Қачон бериш:</b>\nСиз кўрилган жиноят ёки маъмурий ҳуқуқбузарлик иши бўйича жабрланувчи, гувоҳ, судланувчи ёки бошқа қатнашчи бўлгансиз — суд ҳукми ёки бошқа иш ҳужжатларининг нусхасини олиш керак.\n\n🏛 <b>Қаерга:</b>\nИш кўрилган жиноят суди раисига.\n\n📎 <b>Илова қилинадиган ҳужжатлар:</b>\n• Паспорт нусхаси\n• Иш бўйича Сизнинг иштирокингизни тасдиқловчи ҳужжат (бўлса)\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → суд раиси Ф.И.Ш. → иш тури (жиноят ёки маъмурий) → иш кўрилган сана → судланувчи Ф.И.Ш.`,
    `📑 <b>Sud hukmi va ish hujjatlaridan nusxalar olish</b>\n\n📋 <b>Qachon berish:</b>\nSiz ko‘rilgan jinoyat yoki ma'muriy huquqbuzarlik ishi bo‘yicha jabrlanuvchi, guvoh, sudlanuvchi yoki boshqa qatnashchi bo‘lgansiz — sud hukmi yoki boshqa ish hujjatlarining nusxasini olish kerak.\n\n🏛 <b>Qayerga:</b>\nIsh ko‘rilgan jinoyat sudi raisiga.\n\n📎 <b>Ilova qilinadigan hujjatlar:</b>\n• Pasport nusxasi\n• Ish bo‘yicha Sizning ishtirokingizni tasdiqlovchi hujjat (bo‘lsa)\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → sud raisi F.I.SH. → ish turi (jinoyat yoki ma'muriy) → ish ko‘rilgan sana → sudlanuvchi F.I.SH.`,
    `📑 <b>Получение копий приговора и материалов дела</b>\n\n📋 <b>Когда подавать:</b>\nВы были потерпевшим, свидетелем, подсудимым или иным участником по рассмотренному уголовному либо административному делу — нужны копии приговора суда или иных материалов дела.\n\n🏛 <b>Куда:</b>\nПредседателю уголовного суда, рассмотревшего дело.\n\n📎 <b>Документы:</b>\n• Копия паспорта\n• Документ, подтверждающий ваше участие в деле (если есть)\n\n📝 <b>Бот спросит:</b>\nваши данные → ФИО председателя суда → тип дела (уголовное или административное) → дата рассмотрения дела → ФИО подсудимого.`,
  ),
  fileNameBase: 'ariza-jinoyat-nuskha',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'chairman_name',
      L(
        '👨‍⚖️ Суд раиси Ф.И.Ш.',
        '👨‍⚖️ Sud raisi F.I.SH.',
        '👨‍⚖️ Ф.И.О. председателя суда',
      ),
      L(
        'Масалан: С.Расулов',
        'Masalan: S.Rasulov',
        'Например: С.Расулов',
      ),
    ),
    F.choice(
      'case_type',
      L(
        '⚖️ Иш тури',
        '⚖️ Ish turi',
        '⚖️ Тип дела',
      ),
      [
        {
          value: 'jinoyat',
          label: L(
            'Жиноят иши',
            'Jinoyat ishi',
            'Уголовное дело',
          ),
        },
        {
          value: 'mamuriy',
          label: L(
            'Маъмурий ҳуқуқбузарлик',
            "Ma'muriy huquqbuzarlik",
            'Административное правонарушение',
          ),
        },
      ],
    ),
    F.splitDate(
      'case_date',
      L(
        '📅 Иш кўрилган сана',
        "📅 Ish ko‘rilgan sana",
        '📅 Дата рассмотрения дела',
      ),
      { yearKey: 'case_year', monthKey: 'case_month', dayKey: 'case_day' },
    ),
    F.fio(
      'defendant_fio',
      L(
        '👤 Судланувчи Ф.И.Ш.',
        "👤 Sudlanuvchi F.I.SH.",
        '👤 Ф.И.О. подсудимого',
      ),
    ),
  ],
};

/* ============================================================
 * 14c. JINOYAT — МЖтК 315 (objection to administrative penalty)
 * ============================================================ */
const T_JIN_315: TemplateDef = {
  code: 'ariza-jinoyat-315',
  category: 'ariza',
  courtTypeCode: 'jinoyat',
  title: L(
    '🛡 МЖтК 315: жарима қарорига эътироз',
    "🛡 MJtK 315: jarima qaroriga e'tiroz",
    '🛡 МЖтК 315: возражение на штраф',
  ),
  subtitle: L(
    'маъмурий жарима қарорини бекор қилиш/ўзгартириш',
    "ma'muriy jarima qarorini bekor qilish/o‘zgartirish",
    'отмена или изменение постановления',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `🛡 <b>МЖтК 315: маъмурий жарима қарорига эътироз</b>\n\n📋 <b>Қачон бериш:</b>\nСизга нисбатан давлат органи (солиқ, ИИБ, ЙХХБ ва ҳ.к.) маъмурий жарима қўллаш тўғрисида қарор қабул қилган бўлса ва Сиз у билан рози бўлмасангиз.\n\n⚠️ <b>Муддат — 10 кун</b> (қарор нусхасини қўлингизга олганингиздан бошлаб).\n\n🏛 <b>Қаерга:</b>\nЖиноят ишлари бўйича туман/шаҳар судининг тергов судьясига.\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → қарор чиқарган орган → қарор санаси → МЖтК моддаси → норозилик сабаблари → қарор сериси ва рақами → бекор қилиш/ўзгартириш танлови → илова ҳужжатлар сони.`,
    `🛡 <b>MJtK 315: ma'muriy jarima qaroriga e'tiroz</b>\n\n📋 <b>Qachon berish:</b>\nSizga nisbatan davlat organi (soliq, IIB, YXXB va h.k.) ma'muriy jarima qo‘llash to‘g‘risida qaror qabul qilgan bo‘lsa va Siz u bilan rozi bo‘lmasangiz.\n\n⚠️ <b>Muddat — 10 kun</b> (qaror nusxasini qo‘lingizga olganingizdan boshlab).\n\n🏛 <b>Qayerga:</b>\nJinoyat ishlari bo‘yicha tuman/shahar sudining tergov sudyasiga.\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → qaror chiqargan organ → qaror sanasi → MJtK moddasi → norozilik sabablari → qaror seriya va raqami → bekor qilish/o‘zgartirish tanlovi → ilova hujjatlar soni.`,
    `🛡 <b>МЖтК 315: возражение на постановление об административном штрафе</b>\n\n📋 <b>Когда подавать:</b>\nЕсли в отношении Вас государственный орган (налоговая, ОВД, БДД и т.п.) вынес постановление о наложении штрафа, а Вы с ним не согласны.\n\n⚠️ <b>Срок — 10 дней</b> (с момента получения копии постановления).\n\n🏛 <b>Куда:</b>\nСледственному судье уголовного суда района/города.\n\n📝 <b>Бот спросит:</b>\nваши данные → орган, вынесший постановление → дата постановления → статья МЖтК → причины несогласия → серия и номер постановления → выбор «отменить»/«изменить» → количество прилагаемых документов.`,
  ),
  fileNameBase: 'ariza-jinoyat-315',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'penalty_org',
      L(
        '🏛 Қарор чиқарган орган',
        '🏛 Qaror chiqargan organ',
        '🏛 Орган, вынесший постановление',
      ),
      L(
        'Масалан: Давлат солиқ инспекцияси, ИИБ ЙХХБ',
        "Masalan: Davlat soliq inspeksiyasi, IIB YXXB",
        'Например: Государственная налоговая инспекция, ОВД БДД',
      ),
    ),
    F.splitDate(
      'order_date',
      L(
        '📅 Қарор санаси',
        '📅 Qaror sanasi',
        '📅 Дата постановления',
      ),
      { yearKey: 'order_year', monthKey: 'order_month', dayKey: 'order_day' },
    ),
    F.text(
      'mjtk_article',
      L(
        '📑 МЖтК моддаси',
        '📑 MJtK moddasi',
        '📑 Статья МЖтК',
      ),
      L('Масалан: 128, 184', 'Masalan: 128, 184', 'Например: 128, 184'),
    ),
    NARRATIVE(
      'disagreement_reasons',
      L(
        '📝 Норозилик сабаблари',
        "📝 Norozilik sabablari",
        '📝 Причины несогласия',
      ),
      L(
        'Нима учун қарор билан рози эмассиз — фактик асосларни кўрсатинг.',
        "Nima uchun qaror bilan rozi emassiz — faktik asoslarni ko‘rsating.",
        'Почему Вы не согласны с постановлением — приведите фактические основания.',
      ),
    ),
    F.text(
      'order_number',
      L(
        '🔢 Қарор рақами',
        '🔢 Qaror raqami',
        '🔢 Номер постановления',
      ),
      L(
        'Масалан: АА-123456',
        'Masalan: AA-123456',
        'Например: АА-123456',
      ),
    ),
    F.choice(
      'action_type',
      L(
        '⚖️ Сўралаётган ҳаракат',
        '⚖️ So‘ralayotgan harakat',
        '⚖️ Запрашиваемое действие',
      ),
      [
        {
          value: 'bekor',
          label: L('Бекор қилиш', 'Bekor qilish', 'Отменить'),
        },
        {
          value: 'ozgartirish',
          label: L("Ўзгартириш", "O‘zgartirish", 'Изменить'),
        },
      ],
    ),
    F.num(
      'attached_docs_count',
      L(
        '📎 Илова ҳужжатлар сони',
        "📎 Ilova hujjatlar soni",
        '📎 Количество прилагаемых документов',
      ),
    ),
  ],
};

/* ============================================================
 * 14d. JINOYAT — МЖтК 316 (restore missed 10-day appeal deadline)
 * ============================================================ */
const T_JIN_316: TemplateDef = {
  code: 'iltimosnoma-jinoyat-316',
  category: 'iltimosnoma',
  courtTypeCode: 'jinoyat',
  title: L(
    '⏰ МЖтК 316: муддат тиклаш',
    "⏰ MJtK 316: muddat tiklash",
    '⏰ МЖтК 316: восстановить срок',
  ),
  subtitle: L(
    '10 кунлик шикоят муддатини тиклаш',
    "10 kunlik shikoyat muddatini tiklash",
    'восстановление 10-дневного срока обжалования',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `⏰ <b>МЖтК 316: 10 кунлик шикоят муддатини тиклаш</b>\n\n📋 <b>Қачон бериш:</b>\nМаъмурий жарима қарори чиққанини кеч билдингиз ёки узрли сабаб (касаллик, командировка ва ҳ.к.) туфайли 10 кунлик муддатни ўтказиб юбордингиз.\n\n🏛 <b>Қаерга:</b>\nЖиноят ишлари бўйича туман/шаҳар судининг тергов судьясига.\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → қарор чиқарган орган → қарор санаси → МЖтК моддаси → қачон ва қандай билдингиз → муддат ўтказиш сабаби.`,
    `⏰ <b>MJtK 316: 10 kunlik shikoyat muddatini tiklash</b>\n\n📋 <b>Qachon berish:</b>\nMa'muriy jarima qarori chiqqanini kech bildingiz yoki uzrli sabab tufayli 10 kunlik muddatni o‘tkazib yubordingiz.\n\n🏛 <b>Qayerga:</b>\nJinoyat ishlari bo‘yicha tuman/shahar sudining tergov sudyasiga.\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → qaror chiqargan organ → qaror sanasi → MJtK moddasi → qachon va qanday bildingiz → muddat o‘tkazish sababi.`,
    `⏰ <b>МЖтК 316: восстановление 10-дневного срока обжалования</b>\n\n📋 <b>Когда подавать:</b>\nЕсли узнали о вынесении постановления о штрафе с опозданием или по уважительной причине (болезнь, командировка и т.п.) пропустили 10-дневный срок.\n\n🏛 <b>Куда:</b>\nСледственному судье уголовного суда района/города.\n\n📝 <b>Бот спросит:</b>\nваши данные → орган, вынесший постановление → дата постановления → статья МЖтК → когда и как узнали → причина пропуска срока.`,
  ),
  fileNameBase: 'iltimosnoma-jinoyat-316',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'penalty_org',
      L(
        '🏛 Қарор чиқарган орган',
        '🏛 Qaror chiqargan organ',
        '🏛 Орган, вынесший постановление',
      ),
      L(
        'Масалан: Давлат солиқ инспекцияси, ИИБ ЙХХБ',
        "Masalan: Davlat soliq inspeksiyasi, IIB YXXB",
        'Например: Государственная налоговая инспекция, ОВД БДД',
      ),
    ),
    F.splitDate(
      'order_date',
      L(
        '📅 Қарор санаси',
        '📅 Qaror sanasi',
        '📅 Дата постановления',
      ),
      { yearKey: 'order_year', monthKey: 'order_month', dayKey: 'order_day' },
    ),
    F.text(
      'mjtk_article',
      L('📑 МЖтК моддаси', '📑 MJtK moddasi', '📑 Статья МЖтК'),
      L('Масалан: 128, 184', 'Masalan: 128, 184', 'Например: 128, 184'),
    ),
    F.splitDate(
      'learned_date',
      L(
        '📅 Қачон билдингиз',
        "📅 Qachon bildingiz",
        '📅 Когда узнали',
      ),
      { yearKey: 'learned_year', monthKey: 'learned_month', dayKey: 'learned_day' },
    ),
    F.text(
      'learned_how',
      L(
        '📨 Қандай билдингиз',
        '📨 Qanday bildingiz',
        '📨 Как узнали',
      ),
      L(
        'Масалан: почта орқали хат олдим',
        "Masalan: pochta orqali xat oldim",
        'Например: получил письмо по почте',
      ),
    ),
    NARRATIVE(
      'missing_reason',
      L(
        '📝 Муддат ўтказиш сабаби',
        "📝 Muddat o‘tkazish sababi",
        '📝 Причина пропуска срока',
      ),
      L(
        'Узрли сабабни кўрсатинг: касаллик, командировка ва бошқалар.',
        "Uzrli sababni ko‘rsating: kasallik, komandirovka va boshqalar.",
        'Укажите уважительную причину: болезнь, командировка и т.п.',
      ),
    ),
  ],
};

/* ============================================================
 * 14e. JINOYAT — танишув (review case materials)
 * ============================================================ */
const T_JIN_TANISH: TemplateDef = {
  code: 'ariza-jinoyat-tanishuv',
  category: 'ariza',
  courtTypeCode: 'jinoyat',
  title: L(
    '🔍 Иш ҳужжатлари билан танишув',
    "🔍 Ish hujjatlari bilan tanishuv",
    '🔍 Ознакомление с материалами дела',
  ),
  subtitle: L(
    'жиноят/маъмурий иш бўйича',
    "jinoyat/ma'muriy ish bo‘yicha",
    'по уголовному/административному делу',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `🔍 <b>Иш ҳужжатлари билан танишув</b>\n\n📋 <b>Қачон бериш:</b>\nСиз кўрилаётган ёки кўрилган жиноят/маъмурий иш бўйича иштирокчисиз (шахсан ёки жабрланувчи орқали) ва иш материаллари билан танишиш керак.\n\n🏛 <b>Қаерга:</b>\nЖиноят ишлари бўйича туман/шаҳар суди раисига.\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → суд раиси Ф.И.Ш. → ўзингиз/жабрланувчи танлови → жабрланувчи Ф.И.Ш. (агар жабрланувчи бўлсангиз) → иш санаси → иш ҳолати (кўрилган/кўрилаётган) → иш тури.`,
    `🔍 <b>Ish hujjatlari bilan tanishuv</b>\n\n📋 <b>Qachon berish:</b>\nSiz ko‘rilayotgan yoki ko‘rilgan jinoyat/ma'muriy ish bo‘yicha ishtirokchisiz va ish materiallari bilan tanishish kerak.\n\n🏛 <b>Qayerga:</b>\nJinoyat ishlari bo‘yicha tuman/shahar sudi raisiga.\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → sud raisi F.I.SH. → o‘zingiz/jabrlanuvchi tanlovi → jabrlanuvchi F.I.SH. → ish sanasi → ish holati → ish turi.`,
    `🔍 <b>Ознакомление с материалами дела</b>\n\n📋 <b>Когда подавать:</b>\nВы участник рассматриваемого/рассмотренного уголовного/административного дела (лично или как потерпевший) и хотите ознакомиться с материалами дела.\n\n🏛 <b>Куда:</b>\nПредседателю уголовного суда района/города.\n\n📝 <b>Бот спросит:</b>\nваши данные → ФИО председателя → за себя/как потерпевший → ФИО потерпевшего (если потерпевший) → дата дела → статус дела → тип дела.`,
  ),
  fileNameBase: 'ariza-jinoyat-tanishuv',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'chairman_name',
      L(
        '👨‍⚖️ Суд раиси Ф.И.Ш.',
        '👨‍⚖️ Sud raisi F.I.SH.',
        '👨‍⚖️ Ф.И.О. председателя суда',
      ),
      L(
        'Масалан: С.Расулов',
        'Masalan: S.Rasulov',
        'Например: С.Расулов',
      ),
    ),
    F.choice(
      'party_role',
      L(
        '👥 Сиз ишда кимсиз',
        '👥 Siz ishda kimsiz',
        '👥 Ваша роль в деле',
      ),
      [
        {
          value: 'self',
          label: L('Ўзим', 'O‘zim', 'Я сам(а)'),
        },
        {
          value: 'victim',
          label: L('Жабрланувчи орқали', "Jabrlanuvchi orqali", 'Через потерпевшего'),
        },
      ],
    ),
    {
      ...F.fio(
        'victim_fio',
        L(
          '👤 Жабрланувчи Ф.И.Ш.',
          "👤 Jabrlanuvchi F.I.SH.",
          '👤 Ф.И.О. потерпевшего',
        ),
      ),
      skipIf: (v) => v.party_role !== 'victim',
      skipValue: '—',
    },
    F.splitDate(
      'case_date',
      L(
        '📅 Иш санаси',
        "📅 Ish sanasi",
        '📅 Дата дела',
      ),
      { yearKey: 'case_year', monthKey: 'case_month', dayKey: 'case_day' },
    ),
    F.choice(
      'case_status',
      L(
        '📋 Иш ҳолати',
        "📋 Ish holati",
        '📋 Статус дела',
      ),
      [
        {
          value: 'considered',
          label: L('Кўрилган', "Ko‘rilgan", 'Рассмотрено'),
        },
        {
          value: 'in-progress',
          label: L('Кўрилаётган', "Ko‘rilayotgan", 'Рассматривается'),
        },
      ],
    ),
    F.choice(
      'case_type',
      L(
        '⚖️ Иш тури',
        '⚖️ Ish turi',
        '⚖️ Тип дела',
      ),
      [
        {
          value: 'jinoyat',
          label: L('Жиноят иши', 'Jinoyat ishi', 'Уголовное дело'),
        },
        {
          value: 'mamuriy',
          label: L(
            'Маъмурий ҳуқуқбузарлик',
            "Ma'muriy huquqbuzarlik",
            'Административное правонарушение',
          ),
        },
      ],
    ),
  ],
};

/* ============================================================
 * 14f. JINOYAT — appellate / cassation complaint (admin penalty)
 * ============================================================ */
const T_JIN_APPEAL: TemplateDef = {
  code: 'shikoyat-jinoyat-apellyatsiya',
  category: 'shikoyat',
  courtTypeCode: 'jinoyat',
  title: L(
    '📣 Апелляция/Кассация шикояти',
    "📣 Apellyatsiya/Kassatsiya shikoyati",
    '📣 Апелляционная/Кассационная жалоба',
  ),
  subtitle: L(
    'маъмурий жазо қарорига нисбатан',
    "ma'muriy jazo qaroriga nisbatan",
    'на решение об административном наказании',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `📣 <b>Апелляция / Кассация шикояти</b>\n\n📋 <b>Қачон бериш:</b>\nТуман/шаҳар суди томонидан Сизга нисбатан маъмурий жазо қўлланди ва Сиз қарор адолатсиз деб ҳисоблайсиз — апелляция (10 кун ичида) ёки кассация инстанциясига шикоят беришингиз мумкин.\n\n🏛 <b>Қаерга:</b>\nВилоят судининг жиноят ишлари бўйича судлов ҳайъатига. <b>Битта суд танлаб қўйинг — областной</b>, чунки шикоят ҳудудий судга юборилади.\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → инстанция (апелляция/кассация) → қарор санаси → МЖтК моддаси → норозилик сабаблари → бошқа далиллар/гувоҳлар.`,
    `📣 <b>Apellyatsiya / Kassatsiya shikoyati</b>\n\n📋 <b>Qachon berish:</b>\nTuman/shahar sudi tomonidan Sizga nisbatan ma'muriy jazo qo‘llanildi va Siz qaror adolatsiz deb hisoblaysiz — apellyatsiya (10 kun ichida) yoki kassatsiya instansiyasiga shikoyat berishingiz mumkin.\n\n🏛 <b>Qayerga:</b>\nViloyat sudining jinoyat ishlari bo‘yicha sudlov hay'atiga. <b>Sud tanlovida viloyat sudini tanlang.</b>\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → instansiya tanlovi → qaror sanasi → MJtK moddasi → norozilik sabablari → boshqa dalillar/guvohlar.`,
    `📣 <b>Апелляционная / Кассационная жалоба</b>\n\n📋 <b>Когда подавать:</b>\nЕсли городской/районный уголовный суд назначил Вам административное наказание, а Вы считаете решение несправедливым — можете подать апелляционную (в течение 10 дней) или кассационную жалобу.\n\n🏛 <b>Куда:</b>\nВ судебную коллегию по уголовным делам областного суда. <b>В выборе суда укажите областной суд.</b>\n\n📝 <b>Бот спросит:</b>\nваши данные → выбор инстанции → дата решения → статья МЖтК → причины несогласия → дополнительные доказательства/свидетели.`,
  ),
  fileNameBase: 'shikoyat-jinoyat-apellyatsiya',
  fields: [
    ...APPLICANT_BLOCK,
    F.choice(
      'instance_type',
      L(
        '⚖️ Инстанция',
        '⚖️ Instansiya',
        '⚖️ Инстанция',
      ),
      [
        {
          value: 'apellyatsiya',
          label: L('Апелляция', 'Apellyatsiya', 'Апелляционная'),
        },
        {
          value: 'kassatsiya',
          label: L('Кассация', 'Kassatsiya', 'Кассационная'),
        },
      ],
    ),
    F.text(
      'lower_court_name',
      L(
        '🏛 Қарор чиқарган суд',
        '🏛 Qaror chiqargan sud',
        '🏛 Суд, вынесший решение',
      ),
      L(
        'Масалан: Жиноят ишлари бўйича Жиззах шаҳар суди',
        "Masalan: Jinoyat ishlari bo‘yicha Jizzax shahar sudi",
        'Например: Уголовный суд города Джизак',
      ),
    ),
    F.splitDate(
      'order_date',
      L(
        '📅 Қарор санаси',
        '📅 Qaror sanasi',
        '📅 Дата решения',
      ),
      { yearKey: 'order_year', monthKey: 'order_month', dayKey: 'order_day' },
    ),
    F.text(
      'mjtk_article',
      L('📑 МЖтК моддаси', '📑 MJtK moddasi', '📑 Статья МЖтК'),
      L('Масалан: 128, 184', 'Masalan: 128, 184', 'Например: 128, 184'),
    ),
    NARRATIVE(
      'disagreement_reasons',
      L(
        '📝 Норозилик сабаблари',
        "📝 Norozilik sabablari",
        '📝 Причины несогласия',
      ),
      L(
        'Нима учун суд қарори адолатсиз — асосларни кўрсатинг.',
        "Nima uchun sud qarori adolatsiz — asoslarni ko‘rsating.",
        'Почему решение суда несправедливо — приведите основания.',
      ),
    ),
    NARRATIVE(
      'additional_evidence',
      L(
        '🔎 Бошқа далиллар/гувоҳлар',
        "🔎 Boshqa dalillar/guvohlar",
        '🔎 Дополнительные доказательства/свидетели',
      ),
      L(
        'Бўлса кўрсатинг, бўлмаса “йўқ” деб ёзинг.',
        "Bo‘lsa ko‘rsating, bo‘lmasa “yo‘q” deb yozing.",
        'Если есть — укажите, если нет — напишите «нет».',
      ),
    ),
  ],
};

/* ============================================================
 * 14g. JINOYAT — МЖтК 324³ (restore appellate deadline)
 * ============================================================ */
const T_JIN_3243: TemplateDef = {
  code: 'iltimosnoma-jinoyat-3243',
  category: 'iltimosnoma',
  courtTypeCode: 'jinoyat',
  title: L(
    '⏰ МЖтК 324³: апелляция муддатини тиклаш',
    "⏰ MJtK 324³: apellyatsiya muddatini tiklash",
    '⏰ МЖтК 324³: восстановить срок апелляции',
  ),
  subtitle: L(
    '10 суткалик апелляция шикоят муддати',
    "10 sutkalik apellyatsiya shikoyat muddati",
    '10-суточный срок апелляционного обжалования',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `⏰ <b>МЖтК 324³: апелляция шикоят муддатини тиклаш</b>\n\n📋 <b>Қачон бериш:</b>\nТуман/шаҳар суди томонидан Сизга нисбатан маъмурий жазо қўлланди, лекин 10 суткалик апелляция шикоят муддатини узрли сабаб (касаллик, командировка ва ҳ.к.) туфайли ўтказиб юбордингиз.\n\n🏛 <b>Қаерга:</b>\nҚарор чиқарган туман/шаҳар судининг тергов судьясига.\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → қарор санаси → МЖтК моддаси → қачон ва қандай билдингиз → муддат ўтказиш сабаби.`,
    `⏰ <b>MJtK 324³: apellyatsiya shikoyat muddatini tiklash</b>\n\n📋 <b>Qachon berish:</b>\nTuman/shahar sudi tomonidan Sizga nisbatan ma'muriy jazo qo‘llanildi, lekin 10 sutkalik apellyatsiya shikoyat muddatini uzrli sabab tufayli o‘tkazib yubordingiz.\n\n🏛 <b>Qayerga:</b>\nQaror chiqargan tuman/shahar sudining tergov sudyasiga.\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → qaror sanasi → MJtK moddasi → qachon va qanday bildingiz → muddat o‘tkazish sababi.`,
    `⏰ <b>МЖтК 324³: восстановление срока апелляционного обжалования</b>\n\n📋 <b>Когда подавать:</b>\nГородским/районным судом Вам назначено административное наказание, но Вы пропустили 10-суточный срок апелляции по уважительной причине (болезнь, командировка и т.п.).\n\n🏛 <b>Куда:</b>\nСледственному судье уголовного суда, вынесшего решение.\n\n📝 <b>Бот спросит:</b>\nваши данные → дата решения → статья МЖтК → когда и как узнали → причина пропуска срока.`,
  ),
  fileNameBase: 'iltimosnoma-jinoyat-3243',
  fields: [
    ...APPLICANT_BLOCK,
    F.splitDate(
      'order_date',
      L(
        '📅 Қарор санаси',
        '📅 Qaror sanasi',
        '📅 Дата решения',
      ),
      { yearKey: 'order_year', monthKey: 'order_month', dayKey: 'order_day' },
    ),
    F.text(
      'mjtk_article',
      L('📑 МЖтК моддаси', '📑 MJtK moddasi', '📑 Статья МЖтК'),
      L('Масалан: 128, 184', 'Masalan: 128, 184', 'Например: 128, 184'),
    ),
    F.splitDate(
      'learned_date',
      L(
        '📅 Қачон билдингиз',
        "📅 Qachon bildingiz",
        '📅 Когда узнали',
      ),
      { yearKey: 'learned_year', monthKey: 'learned_month', dayKey: 'learned_day' },
    ),
    F.text(
      'learned_how',
      L(
        '📨 Қандай билдингиз',
        '📨 Qanday bildingiz',
        '📨 Как узнали',
      ),
      L(
        'Масалан: почта орқали хат олдим',
        "Masalan: pochta orqali xat oldim",
        'Например: получил письмо по почте',
      ),
    ),
    NARRATIVE(
      'missing_reason',
      L(
        '📝 Муддат ўтказиш сабаби',
        "📝 Muddat o‘tkazish sababi",
        '📝 Причина пропуска срока',
      ),
      L(
        'Узрли сабабни кўрсатинг: касаллик, командировка ва бошқалар.',
        "Uzrli sababni ko‘rsating: kasallik, komandirovka va boshqalar.",
        'Укажите уважительную причину: болезнь, командировка и т.п.',
      ),
    ),
  ],
};

/* ============================================================
 * 14h. MAMURIY — мансабдор шахс хатти-ҳаракати қонунга хилоф
 *      (declaring official's act illegal + imposing duty)
 * ============================================================ */
const T_MAM_MANSABDOR: TemplateDef = {
  code: 'ariza-mamuriy-mansabdor',
  category: 'ariza',
  courtTypeCode: 'mamuriy',
  title: L(
    '⚖️ Мансабдор шахс ҳаракати',
    "⚖️ Mansabdor shaxs harakati",
    '⚖️ Действия должностного лица',
  ),
  subtitle: L(
    'қонунга хилоф деб топиб, мажбурият юклаш',
    "qonunga xilof deb topib, majburiyat yuklash",
    'признать незаконными + наложить обязанность',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `⚖️ <b>Мансабдор шахс ҳаракати/ҳаракатсизлиги қонунга хилоф деб топиш</b>\n\n📋 <b>Қачон бериш:</b>\nДавлат идораси, ваколатли орган ёки уларнинг мансабдор шахси Сизнинг ҳуқуқларингизни бузувчи ҳаракат/ҳаракатсизликни амалга оширган бўлса. Бот суддан буларни қонунга хилоф деб топишни ва жавобгарга маълум бир мажбуриятни (масалан, ҳужжат бериш, рад қарорини бекор қилиш) юклашни сўрашга ёрдам беради.\n\n📜 <b>Қонуний асос:</b>\nМаъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддаси.\n\n🏛 <b>Қаерга:</b>\nТуманлараро маъмурий суди раисига.\n\n📎 <b>Илова қилинадиган ҳужжатлар (МСИЮКнинг 130-моддаси):</b>\n• давлат божи квитанцияси (МСИЮКнинг 10-моддаси бўйича айрим тоифалар озод қилинади)\n• почта харажати квитанцияси\n• ариза ва ҳужжатлар нусхалари жавобгарга/учинчи шахсларга юборилганлиги\n• талабларга асос бўлган ҳолатлар бўйича ҳужжатлар\n• ваколатнома (вакил орқали юборилса)\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → жавобгар (ташкилот) номи ва манзили → нима юз берди (далиллар ва қонуний асослар) → ҳаракат/ҳаракатсизлик қайси мансабдор томонидан → суддан қайси мажбуриятни юклашни сўрайсиз → илова рўйхати.`,
    `⚖️ <b>Mansabdor shaxs harakati/harakatsizligini qonunga xilof deb topish</b>\n\n📋 <b>Qachon berish:</b>\nDavlat idorasi yoki vakolatli organ Sizning huquqlaringizni buzuvchi harakat/harakatsizlik amalga oshirgan bo‘lsa. Bot suddan buni qonunga xilof deb topishni va javobgarga ma'lum bir majburiyatni yuklashni so‘rashga yordam beradi.\n\n📜 <b>Qonuniy asos:</b>\nMa'muriy sud ishlarini yuritish to‘g‘risidagi kodeksning 27-moddasi.\n\n🏛 <b>Qayerga:</b>\nTumanlararo ma'muriy sudi raisiga.\n\n📎 <b>Ilova qilinadigan hujjatlar (MSIYUKning 130-moddasi):</b>\n• davlat boji kvitansiyasi\n• pochta xarajati kvitansiyasi\n• ariza nusxalari javobgarga/uchinchi shaxslarga yuborilgani\n• talablarga asos bo‘lgan hujjatlar\n• vakolatnoma (vakil orqali)\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → javobgar (tashkilot) nomi va manzili → nima yuz berdi (dalillar va qonuniy asoslar) → qaysi mansabdor harakati → suddan qaysi majburiyatni yuklashni so‘raysiz → ilova ro‘yxati.`,
    `⚖️ <b>Признание действий/бездействия должностного лица незаконными</b>\n\n📋 <b>Когда подавать:</b>\nЕсли государственный орган либо его должностное лицо совершило действие или допустило бездействие, нарушающее Ваши права. Бот поможет составить заявление о признании этих действий незаконными и о возложении на ответчика конкретной обязанности (выдать документ, отменить отказ и т. п.).\n\n📜 <b>Правовое основание:</b>\nСтатья 27 Кодекса об административном судопроизводстве (МСИЮК).\n\n🏛 <b>Куда:</b>\nПредседателю межрайонного административного суда.\n\n📎 <b>Документы для приложения (ст. 130 МСИЮК):</b>\n• квитанция о госпошлине (ст. 10 МСИЮК освобождает от пошлины ряд категорий)\n• квитанция о почтовых расходах\n• копии заявления и документов, направленных ответчику и третьим лицам\n• документы, подтверждающие основания требований\n• доверенность (если подаётся через представителя)\n\n📝 <b>Бот спросит:</b>\nваши данные → название и адрес организации-ответчика → что произошло (факты + правовые основания) → какое именно действие/бездействие должностного лица → какую обязанность просите наложить → перечень приложений.`,
  ),
  fileNameBase: 'ariza-mamuriy-mansabdor',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'defendant_org_name',
      L(
        '🏛 Жавобгар (ташкилот) номи',
        '🏛 Javobgar (tashkilot) nomi',
        '🏛 Название организации-ответчика',
      ),
      L(
        'Масалан: Жиззах вилояти Кадастр агентлиги',
        "Masalan: Jizzax viloyati Kadastr agentligi",
        'Например: Кадастровое агентство Джизакской области',
      ),
    ),
    F.address(
      'defendant_address',
      L(
        '🏠 Жавобгар почта манзили',
        "🏠 Javobgar pochta manzili",
        '🏠 Почтовый адрес ответчика',
      ),
    ),
    NARRATIVE(
      'complaint_facts',
      L(
        '📝 Ҳолатлар, далиллар ва қонуний асос',
        "📝 Holatlar, dalillar va qonuniy asos",
        '📝 Обстоятельства, доказательства, правовые основания',
      ),
      L(
        'Нима бўлди, қандай ҳолатлар бор, қайси қонуний нормалар бузилди.',
        "Nima bo‘ldi, qanday holatlar bor, qaysi qonuniy normalar buzildi.",
        'Что произошло, какие обстоятельства, какие нормы права нарушены.',
      ),
    ),
    F.text(
      'official_action',
      L(
        '🏛 Қайси ҳаракат/ҳаракатсизлик қонунга хилоф',
        "🏛 Qaysi harakat/harakatsizlik qonunga xilof",
        '🏛 Какое действие/бездействие незаконно',
      ),
      L(
        'Масалан: ариза рад этилди, ҳужжат берилмади',
        "Masalan: ariza rad etildi, hujjat berilmadi",
        'Например: отказано в заявлении, не выдан документ',
      ),
    ),
    F.text(
      'duty_to_impose',
      L(
        '✅ Суддан қайси мажбуриятни юклашни сўрайсиз',
        "✅ Suddan qaysi majburiyatni yuklashni so‘raysiz",
        '✅ Какую обязанность просите наложить',
      ),
      L(
        'Масалан: ҳужжатни бериш, рад қарорини бекор қилиш',
        "Masalan: hujjatni berish, rad qarorini bekor qilish",
        'Например: выдать документ, отменить отказ',
      ),
    ),
    F.text(
      'attachments_list',
      L(
        '📎 Иловалар рўйхати',
        "📎 Ilovalar ro‘yxati",
        '📎 Перечень приложений',
      ),
      L(
        'Қисқа рўйхат: 1) ... 2) ... 3) ...',
        "Qisqa ro‘yxat: 1) ... 2) ... 3) ...",
        'Краткий перечень: 1) ... 2) ... 3) ...',
      ),
    ),
  ],
};

/* ============================================================
 * 14i. MAMURIY — қарорни ҳақиқий эмас деб топиш
 *      (declaring administrative decision invalid)
 * ============================================================ */
const T_MAM_QAROR_BEKOR: TemplateDef = {
  code: 'ariza-mamuriy-qaror-bekor',
  category: 'ariza',
  courtTypeCode: 'mamuriy',
  title: L(
    '📋 Қарорни ҳақиқий эмас деб топиш',
    "📋 Qarorni haqiqiy emas deb topish",
    '📋 Признать решение недействительным',
  ),
  subtitle: L(
    'давлат органи қарорини бекор қилиш',
    "davlat organi qarorini bekor qilish",
    'отмена решения государственного органа',
  ),
  description: L('—', '—', '—'),
  instructions: L(
    `📋 <b>Маъмурий органнинг қарорини ҳақиқий эмас деб топиш</b>\n\n📋 <b>Қачон бериш:</b>\nДавлат идораси ёки бошқа маъмурий орган Сизга нисбатан қарор қабул қилган бўлса (масалан, лицензия рад этилиши, рўйхатдан ўтказиш рад этилиши, кадастр қайдида хатолик) ва Сиз бу қарорни ноқонуний деб ҳисоблайсангиз.\n\n📜 <b>Қонуний асос:</b>\nМСИЮКнинг 27-моддаси.\n\n🏛 <b>Қаерга:</b>\nТуманлараро маъмурий суди раисига.\n\n📎 <b>Илова қилинадиган ҳужжатлар:</b>\n• давлат божи квитанцияси (МСИЮК 10-модда — айрим тоифалар озод)\n• почта харажати квитанцияси\n• ариза нусхалари жавобгарга юборилгани\n• бекор қилишни сўраётган қарор нусхаси\n• қарорнинг қонунга хилофлигини тасдиқловчи бошқа ҳужжатлар\n\n📝 <b>Бот сўрайди:</b>\nСизнинг маълумотларингиз → жавобгар (қарор чиқарган орган) → қарор санаси ва рақами → ҳолатлар ва қонуний асослар → илова рўйхати.`,
    `📋 <b>Ma'muriy organ qarorini haqiqiy emas deb topish</b>\n\n📋 <b>Qachon berish:</b>\nDavlat idorasi yoki boshqa ma'muriy organ Sizga nisbatan qaror qabul qilgan bo‘lsa va Siz uni noqonuniy deb hisoblasangiz.\n\n📜 <b>Qonuniy asos:</b>\nMSIYUKning 27-moddasi.\n\n🏛 <b>Qayerga:</b>\nTumanlararo ma'muriy sudi raisiga.\n\n📎 <b>Ilova qilinadigan hujjatlar:</b>\n• davlat boji kvitansiyasi\n• pochta xarajati kvitansiyasi\n• ariza nusxalari javobgarga yuborilgani\n• bekor qilishni so‘ralayotgan qaror nusxasi\n• qaror noqonuniyligini tasdiqlovchi boshqa hujjatlar\n\n📝 <b>Bot so‘raydi:</b>\nSizning ma'lumotlaringiz → javobgar (qaror chiqargan organ) → qaror sanasi va raqami → holatlar va qonuniy asoslar → ilova ro‘yxati.`,
    `📋 <b>Признание решения административного органа недействительным</b>\n\n📋 <b>Когда подавать:</b>\nГосударственный орган принял в отношении Вас решение (отказ в лицензии, отказ в регистрации, ошибочная кадастровая запись и т. п.), а Вы считаете это решение незаконным.\n\n📜 <b>Правовое основание:</b>\nСтатья 27 МСИЮК.\n\n🏛 <b>Куда:</b>\nПредседателю межрайонного административного суда.\n\n📎 <b>Документы для приложения:</b>\n• квитанция о госпошлине (ст. 10 МСИЮК — ряд категорий освобождены)\n• квитанция о почтовых расходах\n• копии заявления, направленные ответчику\n• копия оспариваемого решения\n• иные документы, подтверждающие незаконность решения\n\n📝 <b>Бот спросит:</b>\nваши данные → ответчик (вынесший решение орган) → дата и номер решения → обстоятельства и правовые основания → перечень приложений.`,
  ),
  fileNameBase: 'ariza-mamuriy-qaror-bekor',
  fields: [
    ...APPLICANT_BLOCK,
    F.text(
      'defendant_org_name',
      L(
        '🏛 Жавобгар (ташкилот) номи',
        '🏛 Javobgar (tashkilot) nomi',
        '🏛 Название организации-ответчика',
      ),
      L(
        'Масалан: Жиззах вилояти Кадастр агентлиги',
        "Masalan: Jizzax viloyati Kadastr agentligi",
        'Например: Кадастровое агентство Джизакской области',
      ),
    ),
    F.address(
      'defendant_address',
      L(
        '🏠 Жавобгар почта манзили',
        "🏠 Javobgar pochta manzili",
        '🏠 Почтовый адрес ответчика',
      ),
    ),
    NARRATIVE(
      'complaint_facts',
      L(
        '📝 Ҳолатлар, далиллар ва қонуний асос',
        "📝 Holatlar, dalillar va qonuniy asos",
        '📝 Обстоятельства, доказательства, правовые основания',
      ),
      L(
        'Нима бўлди, қандай ҳолатлар бор, қайси қонуний нормалар бузилди.',
        "Nima bo‘ldi, qanday holatlar bor, qaysi qonuniy normalar buzildi.",
        'Что произошло, какие обстоятельства, какие нормы права нарушены.',
      ),
    ),
    F.splitDate(
      'decision_date',
      L(
        '📅 Қарор санаси',
        '📅 Qaror sanasi',
        '📅 Дата решения',
      ),
      { yearKey: 'decision_year', monthKey: 'decision_month', dayKey: 'decision_day' },
    ),
    F.text(
      'decision_number',
      L(
        '🔢 Қарор рақами',
        '🔢 Qaror raqami',
        '🔢 Номер решения',
      ),
      L(
        'Масалан: 123-сонли',
        "Masalan: 123-sonli",
        'Например: № 123',
      ),
    ),
    F.text(
      'attachments_list',
      L(
        '📎 Иловалар рўйхати',
        "📎 Ilovalar ro‘yxati",
        '📎 Перечень приложений',
      ),
      L(
        'Қисқа рўйхат: 1) ... 2) ... 3) ...',
        "Qisqa ro‘yxat: 1) ... 2) ... 3) ...",
        'Краткий перечень: 1) ... 2) ... 3) ...',
      ),
    ),
  ],
};

/* ============================================================
 * 15. Янги очилган ҳолат бўйича бекор қилиш (annul - new circumstances)
 * ============================================================ */
const T_YANGI_HOLAT: TemplateDef = {
  code: 'ariza-yangi-holat-bekor',
  category: 'ariza',
  title: L('🔄 Янги очилган ҳолат', "🔄 Yangi ochilgan holat", '🔄 Новые обстоятельства'),
  subtitle: L('бўйича бекор қилиш', "bo‘yicha bekor qilish", 'отмена решения'),
  description: L('—', '—', '—'),
  instructions: L(
    `🔄 <b>Янги очилган ҳолат бўйича бекор қилиш</b>\n\n📋 <b>Қачон бериш:</b>\nСуд қарори чиққандан сўнг иш натижасига таъсир кўрсатадиган янги ҳолатлар маълум бўлди (ишда тарафлар билмаган ёки далил топилди).\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → иш мазмуни → бекор қилишга асос (эркин тарзда).`,
    `🔄 <b>Yangi ochilgan holat bo‘yicha bekor qilish</b>\n\n📋 <b>Qachon berish:</b>\nSud qarori chiqqandan so‘ng ish natijasiga ta'sir ko‘rsatadigan yangi holatlar ma'lum bo‘ldi.\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → ish mazmuni → bekor qilishga asos.`,
    `🔄 <b>Отмена по вновь открывшимся обстоятельствам</b>\n\n📋 <b>Когда подавать:</b>\nПосле вынесения решения стали известны новые обстоятельства, которые могли повлиять на исход.\n\n📝 <b>Бот спросит:</b>\nданные заявителя → суть дела → основания для отмены.`,
  ),
  fileNameBase: 'ariza-yangi-holat-bekor',
  fields: [
    ...APPLICANT_BLOCK,
    F.choice('party_role', L(
      '👥 Иш бўйича Сиз кимсиз',
      "👥 Ish bo‘yicha Siz kimsiz",
      '👥 Ваша роль в деле',
    ), [
      { value: '1', label: L('Даъвогар', "Da'vogar", 'Истец') },
      { value: '2', label: L('Жавобгар', 'Javobgar', 'Ответчик') },
    ]),
    F.fio('opposite_party_fio', L(
      '👤 Иккинчи тараф Ф.И.Ш.',
      "👤 Ikkinchi taraf F.I.SH.",
      '👤 Ф.И.О. второй стороны',
    )),
    F.text('case_subject', L(
      '⚖️ Иш мазмуни',
      "⚖️ Ish mazmuni",
      '⚖️ Предмет дела',
    ), L(
      'Масалан: банк кредити, мерос',
      "Masalan: bank krediti, meros",
      'Например: банковский кредит, наследство',
    )),
    NARRATIVE(
      'annul_reasons',
      L('📝 Бекор қилишга асослар', "📝 Bekor qilishga asoslar", '📝 Основания для отмены'),
      L('Қандай янги ҳолат маълум бўлди. Қачон билдингиз.', "Qanday yangi holat ma'lum bo‘ldi. Qachon bildingiz.", 'Какое новое обстоятельство открылось. Когда узнали.'),
    ),
  ],
};

/* ============================================================
 * 16. Суд ҳужжати ижросини кечиктириш (postpone execution)
 * ============================================================ */
const T_KECHIKTIRISH: TemplateDef = {
  code: 'ariza-ijroni-kechiktirish',
  category: 'ariza',
  title: L('⏳ Ижрони кечиктириш', "⏳ Ijroni kechiktirish", '⏳ Отсрочка исполнения'),
  subtitle: L('суд ҳужжати', "sud hujjati", 'судебного акта'),
  description: L('—', '—', '—'),
  instructions: L(
    `⏳ <b>Суд ҳужжати ижросини кечиктириш</b>\n\n📋 <b>Қачон бериш:</b>\nСуд қарорини белгиланган муддатда бажариш мумкин эмаслигида (моддий аҳвол, шартлар).\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → иш мазмуни → кечиктириш муддати → сабаблар.`,
    `⏳ <b>Sud hujjati ijrosini kechiktirish</b>\n\n📋 <b>Qachon berish:</b>\nSud qarorini belgilangan muddatda bajarish mumkin emasligida.\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → ish mazmuni → kechiktirish muddati → sabablar.`,
    `⏳ <b>Отсрочка исполнения судебного акта</b>\n\n📋 <b>Когда подавать:</b>\nКогда исполнить решение в установленный срок невозможно (материальное положение и т.п.).\n\n📝 <b>Бот спросит:</b>\nданные заявителя → суть дела → срок отсрочки → причины.`,
  ),
  fileNameBase: 'ariza-ijroni-kechiktirish',
  fields: [
    ...APPLICANT_BLOCK,
    F.choice('party_role', L(
      '👥 Иш бўйича Сиз кимсиз',
      "👥 Ish bo‘yicha Siz kimsiz",
      '👥 Ваша роль в деле',
    ), [
      { value: '1', label: L('Даъвогар', "Da'vogar", 'Истец') },
      { value: '2', label: L('Жавобгар', 'Javobgar', 'Ответчик') },
    ]),
    F.fio('opposite_party_fio', L(
      '👤 Иккинчи тараф Ф.И.Ш.',
      "👤 Ikkinchi taraf F.I.SH.",
      '👤 Ф.И.О. второй стороны',
    )),
    F.text('case_subject', L(
      '⚖️ Иш мазмуни',
      "⚖️ Ish mazmuni",
      '⚖️ Предмет дела',
    ), L(
      'Масалан: банк кредити, мерос',
      "Masalan: bank krediti, meros",
      'Например: банковский кредит, наследство',
    )),
    F.text('postpone_period', L(
      '⏱ Кечиктириш муддати',
      "⏱ Kechiktirish muddati",
      '⏱ Срок отсрочки',
    ), L(
      'Масалан: 6 ой, 1 йил',
      "Masalan: 6 oy, 1 yil",
      'Например: 6 месяцев, 1 год',
    )),
    NARRATIVE(
      'postpone_reasons',
      L('📝 Кечиктириш сабаблари', "📝 Kechiktirish sabablari", '📝 Причины отсрочки'),
      L('Нима учун ҳозир бажариш мумкин эмас. Моддий аҳвол, оила вазияти.', "Nima uchun hozir bajarish mumkin emas. Moddiy ahvol, oila vaziyati.", 'Почему сейчас не можете исполнить. Финансы, семейная ситуация.'),
    ),
  ],
};

/* ============================================================
 * 17. Апелляция шикояти (appeal — regional appellate panel)
 * ============================================================ */
const T_APELLATSIYA: TemplateDef = {
  code: 'appellatsiya-shikoyati',
  category: 'shikoyat',
  title: L('⚖️ Апелляция шикояти', "⚖️ Apellyatsiya shikoyati", '⚖️ Апелляционная жалоба'),
  subtitle: L('ҳал қилув қарорига', "hal qilish qaroriga", 'на решение суда'),
  description: L('—', '—', '—'),
  instructions: L(
    `⚖️ <b>Апелляция шикояти</b>\n\n📋 <b>Қачон бериш:</b>\nТуманлараро фуқаролик судининг ҳал қилув қарорига норозисиз — биринчи апелляция инстанцияси.\n\n⏱ <b>Муддат:</b> Қарор чиққандан кейин 1 ой ичида.\n\n🏛 <b>Қаерга:</b>\nВилоят суди фуқаролик ишлари бўйича апелляция инстанцияси.\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → ҳал қилув қарори санаси → норозилик асослари → талаб (қаноатлантириш/рад этиш).`,
    `⚖️ <b>Apellyatsiya shikoyati</b>\n\n📋 <b>Qachon berish:</b>\nTumanlararo fuqarolik sudining hal qilish qaroriga rozi emassiz — birinchi apellyatsiya instansiyasi.\n\n⏱ <b>Muddat:</b> Qaror chiqqandan keyin 1 oy ichida.\n\n🏛 <b>Qayerga:</b>\nViloyat sudi fuqarolik ishlari bo‘yicha apellyatsiya instansiyasi.\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → hal qilish qarori sanasi → norozilik asoslari → talab.`,
    `⚖️ <b>Апелляционная жалоба</b>\n\n📋 <b>Когда подавать:</b>\nВы не согласны с решением межрайонного гражданского суда — первая апелляционная инстанция.\n\n⏱ <b>Срок:</b> 1 месяц со дня вынесения решения.\n\n🏛 <b>Куда:</b>\nАпелляционная инстанция областного суда по гражданским делам.\n\n📝 <b>Бот спросит:</b>\nданные заявителя → дата решения → основания несогласия → требование (удовл./отказ).`,
  ),
  fileNameBase: 'appellatsiya-shikoyati',
  fields: [
    ...APPLICANT_BLOCK,
    F.splitDate('ruling_date', L(
      '📅 Ҳал қилув қарори санаси',
      "📅 Hal qilish qarori sanasi",
      '📅 Дата решения суда',
    ), {
      yearKey: 'ruling_year', monthKey: 'ruling_month', dayKey: 'ruling_day',
    }),
    F.choice('appeal_outcome', L(
      '🎯 Талабингиз',
      "🎯 Talabingiz",
      '🎯 Ваше требование',
    ), [
      { value: '1', label: L('Даъвони қаноатлантириш', "Da'voni qanoatlantirish", 'Удовлетворить иск') },
      { value: '2', label: L('Даъвони рад қилиш', "Da'voni rad qilish", 'Отказать в иске') },
    ]),
    NARRATIVE(
      'appeal_reasons',
      L('📝 Норозилик асослари', "📝 Norozilik asoslari", '📝 Основания несогласия'),
      L('Нима учун қарор нотўғри: фактлар нотўғри баҳоланган, қонун нотўғри қўлланган.', "Nima uchun qaror noto‘g‘ri: faktlar noto‘g‘ri baholangan, qonun noto‘g‘ri qo‘llangan.", 'Почему решение неверно: факты неверно оценены, закон применён неправильно.'),
    ),
  ],
};

/* ============================================================
 * 18. Тафтиш шикояти (review - second appeal)
 * ============================================================ */
const T_TAFTISH: TemplateDef = {
  code: 'taftish-shikoyati',
  category: 'shikoyat',
  title: L('🔍 Тафтиш шикояти', "🔍 Taftish shikoyati", '🔍 Жалоба в порядке надзора'),
  subtitle: L('тафтиш инстанцияси', "taftish instansiyasi", 'надзорная инстанция'),
  description: L('—', '—', '—'),
  instructions: L(
    `🔍 <b>Тафтиш шикояти</b>\n\n📋 <b>Қачон бериш:</b>\nАпелляция инстанцияси қароридан кейин — иккинчи апелляция (тафтиш).\n\n🏛 <b>Қаерга:</b>\nВилоят суди тафтиш инстанцияси.\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → ҳал қилув қарори санаси → норозилик асослари → талаб.`,
    `🔍 <b>Taftish shikoyati</b>\n\n📋 <b>Qachon berish:</b>\nApellyatsiya instansiyasi qaroridan keyin — ikkinchi apellyatsiya (taftish).\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → hal qilish qarori sanasi → norozilik asoslari → talab.`,
    `🔍 <b>Жалоба в порядке надзора</b>\n\n📋 <b>Когда подавать:</b>\nПосле апелляционного определения — вторая инстанция обжалования (надзор).\n\n📝 <b>Бот спросит:</b>\nданные заявителя → дата решения → основания → требование.`,
  ),
  fileNameBase: 'taftish-shikoyati',
  fields: [
    ...APPLICANT_BLOCK,
    F.splitDate('ruling_date', L(
      '📅 Ҳал қилув қарори санаси',
      "📅 Hal qilish qarori sanasi",
      '📅 Дата решения суда',
    ), {
      yearKey: 'ruling_year', monthKey: 'ruling_month', dayKey: 'ruling_day',
    }),
    F.choice('appeal_outcome', L(
      '🎯 Талабингиз',
      "🎯 Talabingiz",
      '🎯 Ваше требование',
    ), [
      { value: '1', label: L('Даъвони қаноатлантириш', "Da'voni qanoatlantirish", 'Удовлетворить иск') },
      { value: '2', label: L('Даъвони рад қилиш', "Da'voni rad qilish", 'Отказать в иске') },
    ]),
    NARRATIVE(
      'appeal_reasons',
      L('📝 Норозилик асослари', "📝 Norozilik asoslari", '📝 Основания несогласия'),
      L('Нима учун қарор нотўғри: фактлар, қонун, процессуал бузилишлар.', "Nima uchun qaror noto‘g‘ri: faktlar, qonun, protsessual buzilishlar.", 'Почему решение неверно: факты, закон, процессуальные нарушения.'),
    ),
  ],
};

/* ============================================================
 * 19. Кассация шикояти (cassation - third appeal)
 * ============================================================ */
const T_KASSATSIYA: TemplateDef = {
  code: 'kassatsiya-shikoyati',
  category: 'shikoyat',
  title: L('⚡ Кассация шикояти', "⚡ Kassatsiya shikoyati", '⚡ Кассационная жалоба'),
  subtitle: L('кассация инстанцияси', "kassatsiya instansiyasi", 'кассационная инстанция'),
  description: L('—', '—', '—'),
  instructions: L(
    `⚡ <b>Кассация шикояти</b>\n\n📋 <b>Қачон бериш:</b>\nТафтиш инстанциясидан сўнг — учинчи инстанция.\n\n🏛 <b>Қаерга:</b>\nВилоят суди кассация инстанцияси.\n\n📝 <b>Бот сўрайди:</b>\nАризачи маълумотлари → ҳал қилув қарори санаси → норозилик асослари → талаб.`,
    `⚡ <b>Kassatsiya shikoyati</b>\n\n📋 <b>Qachon berish:</b>\nTaftish instansiyasidan so‘ng — uchinchi instansiya.\n\n📝 <b>Bot so‘raydi:</b>\nArizachi ma'lumotlari → hal qilish qarori sanasi → norozilik asoslari → talab.`,
    `⚡ <b>Кассационная жалоба</b>\n\n📋 <b>Когда подавать:</b>\nПосле надзорной инстанции — третья инстанция.\n\n📝 <b>Бот спросит:</b>\nданные заявителя → дата решения → основания → требование.`,
  ),
  fileNameBase: 'kassatsiya-shikoyati',
  fields: [
    ...APPLICANT_BLOCK,
    F.splitDate('ruling_date', L(
      '📅 Ҳал қилув қарори санаси',
      "📅 Hal qilish qarori sanasi",
      '📅 Дата решения суда',
    ), {
      yearKey: 'ruling_year', monthKey: 'ruling_month', dayKey: 'ruling_day',
    }),
    F.choice('appeal_outcome', L(
      '🎯 Талабингиз',
      "🎯 Talabingiz",
      '🎯 Ваше требование',
    ), [
      { value: '1', label: L('Даъвони қаноатлантириш', "Da'voni qanoatlantirish", 'Удовлетворить иск') },
      { value: '2', label: L('Даъвони рад қилиш', "Da'voni rad qilish", 'Отказать в иске') },
    ]),
    NARRATIVE(
      'appeal_reasons',
      L('📝 Норозилик асослари', "📝 Norozilik asoslari", '📝 Основания несогласия'),
      L('Нима учун қарор нотўғри: моддий ёки процессуал қонун бузилиши.', "Nima uchun qaror noto‘g‘ri: moddiy yoki protsessual qonun buzilishi.", 'Почему решение неверно: нарушение материального или процессуального закона.'),
    ),
  ],
};

/**
 * The 19 user-facing templates shown right after `/new`.
 */
export const TEMPLATES: TemplateDef[] = [
  T_ARIZA_ALIMENT,
  T_YOSHGACHA,
  T_ETIROZ,
  T_KAMAYTIRISH,
  T_ILTIMOSNOMA,
  T_NIKOH,
  T_OTALIK,
  T_BOLA_OLISH,
  T_UY_KIRITISH,
  T_KOCHIRISH,
  T_MOL_MULK,
  T_QARZ,
  T_PUL,
  T_NUSHA,
  T_JIN_NUSHA,
  T_JIN_315,
  T_JIN_316,
  T_JIN_TANISH,
  T_JIN_APPEAL,
  T_JIN_3243,
  T_MAM_MANSABDOR,
  T_MAM_QAROR_BEKOR,
  T_YANGI_HOLAT,
  T_KECHIKTIRISH,
  T_APELLATSIYA,
  T_TAFTISH,
  T_KASSATSIYA,
];

export function getTemplateByCode(code: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.code === code);
}

/**
 * Templates whose `courtTypeCode` matches the given code. A missing
 * `courtTypeCode` on a template is treated as 'fuqarolik' — historical
 * templates were all civil-court ones before this field existed.
 */
export function getTemplatesForCourtType(
  courtTypeCode: string,
): TemplateDef[] {
  return TEMPLATES.filter(
    (t) => (t.courtTypeCode ?? 'fuqarolik') === courtTypeCode,
  );
}
