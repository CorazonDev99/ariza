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

/**
 * The 6 user-facing templates shown right after `/new`,
 * in the exact display order requested:
 *   1) Алимент ундириш
 *   2) 3 ёшгача таъминот ундириш
 *   3) Эътирознома
 *   4) Алимент миқдорини камайтириш
 *   5) Илтимоснома (рассмотрение в отсутствие истца)
 *   6) Никоҳдан ажратиш (расторжение брака)
 */
export const TEMPLATES: TemplateDef[] = [
  T_ARIZA_ALIMENT,
  T_YOSHGACHA,
  T_ETIROZ,
  T_KAMAYTIRISH,
  T_ILTIMOSNOMA,
  T_NIKOH,
];

export function getTemplateByCode(code: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.code === code);
}
