/**
 * Generates 5 templates × 3 locales = 15 .docx files into ./templates/
 *
 *   <code>.uz_cyrillic.docx  — original Cyrillic
 *   <code>.uz_latin.docx     — auto-transliterated from Cyrillic
 *   <code>.ru.docx           — manual Russian translation
 *
 * Run: npm run template:sample
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from 'docx';
import { TEMPLATES } from '../src/templates/registry';
import { cyrillicToLatin } from '../src/i18n/transliterate';
import { LOCALES, type Locale } from '../src/i18n';

const OUT_DIR = path.resolve('./templates');

type Align = 'left' | 'center' | 'right' | 'justify';

interface RunSpec {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

interface ParaSpec {
  text: string | RunSpec | RunSpec[];
  align?: Align;
  spaceAfter?: number;
}

/* ============================================================
 * Each template's content is defined as an array of ParaSpec
 * for each locale. uz_latin is derived automatically.
 * ============================================================ */

function transliterateRun(run: RunSpec): RunSpec {
  return { ...run, text: cyrillicToLatin(run.text) };
}

function transliteratePara(p: ParaSpec): ParaSpec {
  if (typeof p.text === 'string') {
    return { ...p, text: cyrillicToLatin(p.text) };
  }
  if (Array.isArray(p.text)) {
    return { ...p, text: p.text.map(transliterateRun) };
  }
  return { ...p, text: transliterateRun(p.text) };
}

function deriveLatin(cyrillic: ParaSpec[]): ParaSpec[] {
  return cyrillic.map(transliteratePara);
}

/**
 * Standard footer block appended to every template:
 *   blank line, divider, QR image, short caption.
 */
function qrFooter(caption: string): ParaSpec[] {
  return [
    { text: '' },
    { text: '' },
    { text: '────────────────────────────', align: 'center' },
    { text: [{ text: '{{%qr_code}}' }], align: 'center' },
    { text: [{ text: caption, italics: true }], align: 'center' },
  ];
}

/* ============================================================
 * Template 1 — Эътирознома (суд буйруғини бекор қилиш)
 * ============================================================ */

const T1_CY: ParaSpec[] = [
  { text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро суди раиси', align: 'right' },
  { text: '{{judge_name}} га', align: 'right' },
  { text: '' },
  { text: '{{plaintiff_address}} да яшовчи', align: 'right' },
  { text: '{{plaintiff_fio}} томонидан', align: 'right' },
  { text: '' },
  { text: [{ text: 'А Р И З А', bold: true }], align: 'center' },
  {
    text: [{
      text: '(ўтказиб юборилган муддатни узрли деб топиш ва суд буйруғини бекор қилиш тўғрисида)',
      italics: true,
    }],
    align: 'center',
  },
  { text: '' },
  {
    text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{order_date}}даги {{order_number}}-сонли суд буйруғига асосан ундирувчи {{collector_name}}нинг суд буйруғини бериш ҳақидаги аризаси қаноатлантирилиб, унга кўра мендан ундирувчи {{collector_name}} фойдасига {{debt_amount}} сўм қарздорлик ва {{postal_costs}} сўм почта ҳаражатлари ҳамда давлат фойдасига {{state_fee}} сўм давлат божи ундириш белгиланган.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Мен ушбу суд буйруғидан мутлақо норозиман, чунки менинг {{collector_name}}дан қарздорлигим мавжуд эмас, ундирувчи томонидан талабномалар ҳам берилмаган.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Шунингдек, суд буйруғи менинг манзилимга етиб келмаган, ушбу суд буйруғи ҳақида МИБ ходимлари огоҳлантиришидан сўнг хабар топдим.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Ўзбекистон Республикаси ФПКнинг 155-моддаси 2-қисми талабига кўра, ишда иштирок этувчи шахслар қонунда белгиланган муддатни суд узрли деб топган сабабларга кўра ўтказиб юборган бўлса, мазкур муддат тикланади.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Ушбу Кодекснинг 181-моддасига талабига кўра, қарздор арз қилинган талабга қарши эътирозларини буйруқни берган суд буйруғининг кўчирма нусхасини олган кундан эътиборан ўн кунлик муддатда юборишга ҳақли. Бундай ҳолда судья суд буйруғини бекор қилиб, бу ҳақда ажрим чиқаради.',
    align: 'justify',
  },
  { text: '' },
  { text: 'Юқоридагиларни инобатга олиб, суддан', align: 'justify' },
  { text: '' },
  { text: [{ text: 'С Ў Р А Й М А Н', bold: true }], align: 'center' },
  { text: '' },
  {
    text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{order_date}}даги {{order_number}}-сонли суд буйруғига нисбатан ўтказиб юборилган муддатни узрли деб топишингизни ва суд буйруғини бекор қилишингизни сўрайман.',
    align: 'justify',
  },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Аризачи                                                          ', bold: true },
    { text: '{{plaintiff_short_fio}}', bold: true },
  ]},
];

const T1_RU: ParaSpec[] = [
  { text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', align: 'right' },
  { text: '{{judge_name}}', align: 'right' },
  { text: '' },
  { text: 'Проживающий(ая) по адресу: {{plaintiff_address}}', align: 'right' },
  { text: 'от {{plaintiff_fio}}', align: 'right' },
  { text: '' },
  { text: [{ text: 'З А Я В Л Е Н И Е', bold: true }], align: 'center' },
  { text: [{ text: '(о признании пропущенного срока уважительным и об отмене судебного приказа)', italics: true }], align: 'center' },
  { text: '' },
  {
    text: 'На основании судебного приказа № {{order_number}} от {{order_date}} межрайонного суда по гражданским делам {{court_name}} удовлетворено заявление взыскателя {{collector_name}} о выдаче судебного приказа, согласно которому с меня в пользу {{collector_name}} взыскано {{debt_amount}} сум задолженности и {{postal_costs}} сум почтовых расходов, а также {{state_fee}} сум государственной пошлины в пользу государства.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Я полностью не согласен(а) с данным судебным приказом, поскольку у меня нет задолженности перед {{collector_name}}, требования со стороны взыскателя также не выставлялись.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Кроме того, судебный приказ по моему адресу не поступал; об указанном судебном приказе я узнал(а) только после уведомления сотрудниками БПИ.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Согласно требованиям части 2 статьи 155 ГПК Республики Узбекистан, если установленный законом срок был пропущен по уважительной причине, признанной судом, данный срок восстанавливается.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'В соответствии с требованиями статьи 181 настоящего Кодекса должник вправе подать возражения относительно предъявленного требования в течение десяти дней со дня получения копии судебного приказа. В этом случае судья отменяет судебный приказ и выносит соответствующее определение.',
    align: 'justify',
  },
  { text: '' },
  { text: 'Учитывая вышеизложенное,', align: 'justify' },
  { text: '' },
  { text: [{ text: 'П Р О Ш У', bold: true }], align: 'center' },
  { text: '' },
  {
    text: 'Признать пропущенный срок уважительным и отменить судебный приказ № {{order_number}} от {{order_date}} межрайонного суда по гражданским делам {{court_name}}.',
    align: 'justify',
  },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Заявитель                                                       ', bold: true },
    { text: '{{plaintiff_short_fio}}', bold: true },
  ]},
];

/* ============================================================
 * Template 2 — Даъво ариза (Алимент миқдорини камайтириш)
 * ============================================================ */

const T2_HEADER_CY: ParaSpec[] = [
  { text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро суди раиси {{judge_name}} га', align: 'right' },
  { text: '' },
  { text: [{ text: 'Даъвогар: ', bold: true }, { text: '{{plaintiff_fio}}' }] },
  { text: '{{plaintiff_address}}' },
  { text: 'Телефон: {{plaintiff_phone}}' },
  { text: '' },
  { text: [{ text: 'Жавобгар: ', bold: true }, { text: '{{defendant_fio}}' }] },
  { text: '{{defendant_address}}' },
  { text: 'Телефон: {{defendant_phone}}' },
  { text: '' },
];

const T2_CY: ParaSpec[] = [
  ...T2_HEADER_CY,
  { text: [{ text: 'ДАЪВО АРИЗА', bold: true }], align: 'center' },
  { text: [{ text: '(АЛИМЕНТ МИҚДОРИНИ КАМАЙТИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  {
    text: 'Биринчи турмуш ўртоғи {{first_spouse_fio}} билан биргаликдаги турмушларимиздан {{first_children_count}} нафар фарзандмиз бор, фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{first_order_date}}даги суд буйруғига асосан {{first_children_count}} нафар фарзандимнинг таъминоти учун ойлик иш ҳақи ва бошқа даромадининг {{first_alimony_share}} қисми миқдорида алимент ундирилган, жавобгар (иккинчи турмуш ўртоғим) {{second_spouse_fio}} билан биргаликдаги турмушмиздан {{second_children_count}} нафар фарзандмиз бор, судининг {{second_order_date}}даги суд буйруғига асосан фарзандларининг таъминоти учун ойлик иш ҳақи ва бошқа даромадининг {{second_alimony_share}} қисми миқдорида алимент ундириш белгиланган, ҳозирги кунда юқоридаги суд қарорларига асосан иккала оиламда бўлган {{total_children_count}} нафар фарзандларимнинг таъминоти учун тўланадиган алиментларнинг миқдори қонунда {{total_children_count}} нафар фарзандлар учун ундирилиши белгиланган алимент миқдоридан ошиб кетган, ушбу суд қарорлари бўйича ундирилиши лозим бўлган алимент миқдорларини қонунга мувофиқлаштириб, {{first_spouse_fio}} ва {{second_spouse_fio}}ларга ундирилаётган алимент миқдорини қонунда белгиланган тартибда камайтиришни сўрайман.',
    align: 'justify',
  },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Даъвогар: ', bold: true },
    { text: '_________ (имзо)            ' },
    { text: '{{plaintiff_fio}}', bold: true },
  ]},
  { text: '' },
  { text: [{ text: 'Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим:', italics: true }] },
  { text: '— Даъво ариза икки нусхада;' },
  { text: '— Суд буйруқлари;' },
  { text: '— Суд буйруқлари бўйича ижро иши қўзғатилганлиги тўғрисида МИБ қарори;' },
  { text: '— Никоҳ тузилганлиги ҳақидаги гувоҳнома асли;' },
  { text: '— Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;' },
  { text: '— Давлат божи ва почта ҳаражати тўланганлиги тўғрисидаги патта.' },
];

const T2_RU: ParaSpec[] = [
  { text: 'Председателю межрайонного суда по гражданским делам {{court_name}} {{judge_name}}', align: 'right' },
  { text: '' },
  { text: [{ text: 'Истец: ', bold: true }, { text: '{{plaintiff_fio}}' }] },
  { text: '{{plaintiff_address}}' },
  { text: 'Телефон: {{plaintiff_phone}}' },
  { text: '' },
  { text: [{ text: 'Ответчик: ', bold: true }, { text: '{{defendant_fio}}' }] },
  { text: '{{defendant_address}}' },
  { text: 'Телефон: {{defendant_phone}}' },
  { text: '' },
  { text: [{ text: 'ИСКОВОЕ ЗАЯВЛЕНИЕ', bold: true }], align: 'center' },
  { text: [{ text: '(ОБ УМЕНЬШЕНИИ РАЗМЕРА АЛИМЕНТОВ)', italics: true }], align: 'center' },
  { text: '' },
  {
    text: 'От совместной жизни с первым супругом(ой) {{first_spouse_fio}} имеется {{first_children_count}} ребёнок(ков); на основании судебного приказа межрайонного суда по гражданским делам {{court_name}} от {{first_order_date}} с меня взыскиваются алименты в размере {{first_alimony_share}} от заработной платы и иных доходов на содержание {{first_children_count}} ребёнка(детей). От совместной жизни со вторым супругом(ой) — ответчиком — {{second_spouse_fio}} имеется {{second_children_count}} ребёнок(ков); на основании судебного приказа от {{second_order_date}} установлено взыскание алиментов в размере {{second_alimony_share}} от заработной платы и иных доходов. В настоящее время общая сумма взыскиваемых алиментов на {{total_children_count}} детей превышает размер, установленный законом для {{total_children_count}} детей. Прошу привести взыскиваемые суммы в соответствие с законом и уменьшить размер алиментов, взыскиваемых в пользу {{first_spouse_fio}} и {{second_spouse_fio}}.',
    align: 'justify',
  },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Истец: ', bold: true }, { text: '_________ (подпись)            ' }, { text: '{{plaintiff_fio}}', bold: true }] },
  { text: '' },
  { text: [{ text: 'К исковому заявлению должны быть приложены следующие документы:', italics: true }] },
  { text: '— Исковое заявление в двух экземплярах;' },
  { text: '— Судебные приказы;' },
  { text: '— Постановление БПИ о возбуждении исполнительного производства по судебным приказам;' },
  { text: '— Оригинал свидетельства о заключении брака;' },
  { text: '— Копия свидетельства о рождении детей;' },
  { text: '— Квитанция об уплате госпошлины и почтовых расходов.' },
];

/* ============================================================
 * Template 3 — Даъво ариза (Ёшгача таъминот)
 * ============================================================ */

const T3_CY: ParaSpec[] = [
  ...T2_HEADER_CY,
  { text: [{ text: 'ДАЪВО АРИЗА', bold: true }], align: 'center' },
  { text: [{ text: '(ЁШГАЧА ТАЪМИНОТ УНДИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  {
    text: 'Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{marriage_date}} куни қонуний никоҳдан ўтиб турмуш қурганмиз.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Биргаликдаги турмушимиздан {{children_count}} нафар {{children_birth_date}} куни туғилган {{children_names}} исмли фарзанд(лар)имиз бор.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Жавобгар билан ўзаро келишмовчиликлар оқибатида {{separation_date}}дан буён бирга яшамаяпмиз.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Вояга етмаган бола(лар)га алимент тўлаш ҳақида ўртамизда келишув йўқ ва қарздор ихтиёрий фарзанд(лар)им таъминоти билан шуғулланмасдан келмоқда.',
    align: 'justify',
  },
  { text: '' },
  {
    text: 'Шу сабабли Сиздан фарзанд(лар)им туғилган кундан эътиборан уч йил давомида қонунда белгиланган тартиб ва миқдорда {{amount}} сўм таъминот ундириб беришингизни сўрайман.',
    align: 'justify',
  },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Даъвогар: ', bold: true }, { text: '_________ (имзо)            ' }, { text: '{{plaintiff_fio}}', bold: true }] },
  { text: '' },
  { text: [{ text: 'Аризага қуйидаги ҳужжатлар илова қилиниши лозим:', italics: true }] },
  { text: '— Даъво ариза икки нусхада;' },
  { text: '— Тарафларнинг паспорт нусхалари;' },
  { text: '— Никоҳ тузилганлиги ҳақидаги гувоҳнома нусхаси;' },
  { text: '— Фарзанд(лар) туғилганлик ҳақидаги гувоҳнома нусхаси;' },
  { text: '— Почта ҳаражати тўланганлиги тўғрисидаги патта.' },
];

const T3_RU: ParaSpec[] = [
  { text: 'Председателю межрайонного суда по гражданским делам {{court_name}} {{judge_name}}', align: 'right' },
  { text: '' },
  { text: [{ text: 'Истец: ', bold: true }, { text: '{{plaintiff_fio}}' }] },
  { text: '{{plaintiff_address}}' },
  { text: 'Телефон: {{plaintiff_phone}}' },
  { text: '' },
  { text: [{ text: 'Ответчик: ', bold: true }, { text: '{{defendant_fio}}' }] },
  { text: '{{defendant_address}}' },
  { text: 'Телефон: {{defendant_phone}}' },
  { text: '' },
  { text: [{ text: 'ИСКОВОЕ ЗАЯВЛЕНИЕ', bold: true }], align: 'center' },
  { text: [{ text: '(О ВЗЫСКАНИИ СОДЕРЖАНИЯ ДО СОВЕРШЕННОЛЕТИЯ)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'Я, {{plaintiff_fio}}, и ответчик {{defendant_fio}} заключили законный брак {{marriage_date}}.', align: 'justify' },
  { text: '' },
  { text: 'От совместной жизни имеется {{children_count}} ребёнок(ков), родившийся(иеся) {{children_birth_date}} — {{children_names}}.', align: 'justify' },
  { text: '' },
  { text: 'Вследствие разногласий с ответчиком мы не проживаем совместно с {{separation_date}}.', align: 'justify' },
  { text: '' },
  { text: 'Соглашения об уплате алиментов между нами нет, и должник добровольно не содержит ребёнка(детей).', align: 'justify' },
  { text: '' },
  { text: 'В связи с этим прошу взыскать с ответчика в установленном законом порядке и размере содержание в сумме {{amount}} сум на ребёнка(детей) в течение трёх лет с момента рождения.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Истец: ', bold: true }, { text: '_________ (подпись)            ' }, { text: '{{plaintiff_fio}}', bold: true }] },
  { text: '' },
  { text: [{ text: 'К заявлению должны быть приложены следующие документы:', italics: true }] },
  { text: '— Исковое заявление в двух экземплярах;' },
  { text: '— Копии паспортов сторон;' },
  { text: '— Копия свидетельства о браке;' },
  { text: '— Копия свидетельства о рождении детей;' },
  { text: '— Квитанция об оплате почтовых расходов.' },
];

/* ============================================================
 * Template 4 — Ариза (Алимент ундириш)
 * ============================================================ */

const T4_CY: ParaSpec[] = [
  { text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро суди раиси {{judge_name}} га', align: 'right' },
  { text: '' },
  { text: [{ text: 'Ундирувчи: ', bold: true }, { text: '{{collector_fio}}' }] },
  { text: '{{collector_address}}' },
  { text: 'Телефон: {{collector_phone}}' },
  { text: '' },
  { text: [{ text: 'Қарздор: ', bold: true }, { text: '{{debtor_fio}}' }] },
  { text: '{{debtor_address}}' },
  { text: 'Телефон: {{debtor_phone}}' },
  { text: '' },
  { text: [{ text: 'А Р И З А', bold: true }], align: 'center' },
  { text: [{ text: '(АЛИМЕНТ УНДИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'Мен {{collector_fio}} қарздор {{debtor_fio}} билан {{marriage_date}} куни қонуний никоҳдан ўтиб турмуш қурганмиз.', align: 'justify' },
  { text: '' },
  { text: 'Биргаликдаги турмушимиздан {{children_count}} нафар {{children_birth_date}} куни туғилган {{children_names}} исмли фарзанд(лар)имиз бор.', align: 'justify' },
  { text: '' },
  { text: 'Қарздор билан ўзаро келишмовчиликлар оқибатида {{separation_date}}дан буён бирга яшамаяпмиз.', align: 'justify' },
  { text: '' },
  { text: 'Вояга етмаган бола(лар)га алимент тўлаш ҳақида ўртамизда келишув йўқ ва қарздор ихтиёрий фарзанд(лар)им таъминоти билан шуғулланмасдан келмоқда.', align: 'justify' },
  { text: '' },
  { text: 'Шу сабабли Сиздан фарзанд(лар)им таъминоти учун алимент ундириш ҳақида суд буйруғи чиқаришингизни сўрайман.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Даъвогар: ', bold: true }, { text: '_________ (имзо)            ' }, { text: '{{collector_fio}}', bold: true }] },
  { text: '' },
  { text: [{ text: 'Аризага қуйидаги ҳужжатлар илова қилиниши лозим:', italics: true }] },
  { text: '— Ариза икки нусхада;' },
  { text: '— Тарафларнинг паспорт нусхалари;' },
  { text: '— Никоҳ тузилганлиги ҳақидаги гувоҳнома нусхаси;' },
  { text: '— Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;' },
  { text: '— Почта ҳаражати тўланганлиги тўғрисидаги патта.' },
];

const T4_RU: ParaSpec[] = [
  { text: 'Председателю межрайонного суда по гражданским делам {{court_name}} {{judge_name}}', align: 'right' },
  { text: '' },
  { text: [{ text: 'Взыскатель: ', bold: true }, { text: '{{collector_fio}}' }] },
  { text: '{{collector_address}}' },
  { text: 'Телефон: {{collector_phone}}' },
  { text: '' },
  { text: [{ text: 'Должник: ', bold: true }, { text: '{{debtor_fio}}' }] },
  { text: '{{debtor_address}}' },
  { text: 'Телефон: {{debtor_phone}}' },
  { text: '' },
  { text: [{ text: 'З А Я В Л Е Н И Е', bold: true }], align: 'center' },
  { text: [{ text: '(О ВЗЫСКАНИИ АЛИМЕНТОВ)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'Я, {{collector_fio}}, и должник {{debtor_fio}} заключили законный брак {{marriage_date}}.', align: 'justify' },
  { text: '' },
  { text: 'От совместной жизни имеется {{children_count}} ребёнок(ков), родившийся(иеся) {{children_birth_date}} — {{children_names}}.', align: 'justify' },
  { text: '' },
  { text: 'Вследствие разногласий с должником мы не проживаем совместно с {{separation_date}}.', align: 'justify' },
  { text: '' },
  { text: 'Соглашения об уплате алиментов между нами нет, и должник добровольно не содержит ребёнка(детей).', align: 'justify' },
  { text: '' },
  { text: 'В связи с этим прошу вынести судебный приказ о взыскании алиментов на содержание моего(их) ребёнка(детей).', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Заявитель: ', bold: true }, { text: '_________ (подпись)            ' }, { text: '{{collector_fio}}', bold: true }] },
  { text: '' },
  { text: [{ text: 'К заявлению должны быть приложены следующие документы:', italics: true }] },
  { text: '— Заявление в двух экземплярах;' },
  { text: '— Копии паспортов сторон;' },
  { text: '— Копия свидетельства о браке;' },
  { text: '— Копия свидетельства о рождении детей;' },
  { text: '— Квитанция об оплате почтовых расходов.' },
];

/* ============================================================
 * Template 5 — Эътирознома (савдо дўкони)
 * ============================================================ */

const T5_CY: ParaSpec[] = [
  { text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро суди раиси {{judge_name}} га', align: 'right' },
  { text: '' },
  { text: [{ text: 'Аризачи (қарздор): ', bold: true }, { text: '{{plaintiff_fio}}' }] },
  { text: '{{plaintiff_address}}' },
  { text: '' },
  { text: [{ text: 'Э Ъ Т И Р О З Н О М А', bold: true }], align: 'center' },
  { text: [{ text: '(Ўтказиб юборилган муддатни узрли деб топиб, суд буйруғини бекор қилиш тўғрисида)', italics: true }], align: 'center' },
  { text: '' },
  { text: '{{order_year}} йил {{order_month}} ойининг {{order_day}} санасида фуқаролик ишлари бўйича {{court_name}} туманлараро суди {{order_number}}-сонли суд буйруғи билан ундирувчи {{creditor_name}} фойдасига қарздор мендан бадал пули ундириш бўйича чиқарилган суд буйруғи чиқарилган.', align: 'justify' },
  { text: '' },
  { text: 'Суд буйруғидан {{order_year}} йил {{learned_month}} ойининг {{learned_day}} кунида хабар топдим.', align: 'justify' },
  { text: '' },
  { text: 'Мен ушбу суд буйруғидан норозиман.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Эътироз сабаблари:', italics: true }] },
  { text: '{{objection_reasons}}', align: 'justify' },
  { text: '' },
  { text: 'Шу сабабли суд буйруғини кеч олганлигини инобатга олиб, ўтказиб юборилган муддатни узрли деб топиб, уни тиклашингизни ва суд буйруғини бекор қилишингизни сўрайман.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Аризачи (қарздор)   ', bold: true }, { text: '_________ (имзо)            ' }, { text: '{{plaintiff_short_fio}}', bold: true }] },
];

const T5_RU: ParaSpec[] = [
  { text: 'Председателю межрайонного суда по гражданским делам {{court_name}} {{judge_name}}', align: 'right' },
  { text: '' },
  { text: [{ text: 'Заявитель (должник): ', bold: true }, { text: '{{plaintiff_fio}}' }] },
  { text: '{{plaintiff_address}}' },
  { text: '' },
  { text: [{ text: 'В О З Р А Ж Е Н И Е', bold: true }], align: 'center' },
  { text: [{ text: '(о признании пропущенного срока уважительным и об отмене судебного приказа)', italics: true }], align: 'center' },
  { text: '' },
  { text: '{{order_day}} {{order_month}} {{order_year}} года межрайонный суд по гражданским делам {{court_name}} вынес судебный приказ № {{order_number}}, согласно которому с меня — должника — в пользу взыскателя {{creditor_name}} взыскан членский взнос.', align: 'justify' },
  { text: '' },
  { text: 'О данном судебном приказе я узнал(а) {{learned_day}} {{learned_month}} {{order_year}} года.', align: 'justify' },
  { text: '' },
  { text: 'Я не согласен(на) с указанным судебным приказом.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Причины возражения:', italics: true }] },
  { text: '{{objection_reasons}}', align: 'justify' },
  { text: '' },
  { text: 'В связи с поздним получением приказа прошу признать пропущенный срок уважительным, восстановить его и отменить судебный приказ.', align: 'justify' },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [{ text: 'Заявитель (должник)   ', bold: true }, { text: '_________ (подпись)            ' }, { text: '{{plaintiff_short_fio}}', bold: true }] },
];

/* ============================================================ */

const FOOTER_CY = qrFooter('Ҳужжатни юклаб олиш учун QR-кодни сканерланг');
const FOOTER_LA = qrFooter('Hujjatni yuklab olish uchun QR-kodni skanerlang');
const FOOTER_RU = qrFooter('Отсканируйте QR-код, чтобы скачать документ');

const withFooter = (body: ParaSpec[], footer: ParaSpec[]): ParaSpec[] => [
  ...body,
  ...footer,
];

const BUILDERS: Record<string, Record<Locale, ParaSpec[]>> = {
  'etirozhoma-sud-buyrugi': {
    uz_cyrillic: withFooter(T1_CY, FOOTER_CY),
    uz_latin: withFooter(deriveLatin(T1_CY), FOOTER_LA),
    ru: withFooter(T1_RU, FOOTER_RU),
  },
  'davo-ariza-aliment-kamaytirish': {
    uz_cyrillic: withFooter(T2_CY, FOOTER_CY),
    uz_latin: withFooter(deriveLatin(T2_CY), FOOTER_LA),
    ru: withFooter(T2_RU, FOOTER_RU),
  },
  'davo-ariza-yoshgacha-taminot': {
    uz_cyrillic: withFooter(T3_CY, FOOTER_CY),
    uz_latin: withFooter(deriveLatin(T3_CY), FOOTER_LA),
    ru: withFooter(T3_RU, FOOTER_RU),
  },
  'ariza-aliment-undirish': {
    uz_cyrillic: withFooter(T4_CY, FOOTER_CY),
    uz_latin: withFooter(deriveLatin(T4_CY), FOOTER_LA),
    ru: withFooter(T4_RU, FOOTER_RU),
  },
  'etirozhoma-savdo': {
    uz_cyrillic: withFooter(T5_CY, FOOTER_CY),
    uz_latin: withFooter(deriveLatin(T5_CY), FOOTER_LA),
    ru: withFooter(T5_RU, FOOTER_RU),
  },
};

/* ============================================================ */

function specToParagraph(s: ParaSpec): Paragraph {
  const alignment =
    s.align === 'center'
      ? AlignmentType.CENTER
      : s.align === 'right'
        ? AlignmentType.RIGHT
        : s.align === 'justify'
          ? AlignmentType.JUSTIFIED
          : AlignmentType.LEFT;
  const runs: RunSpec[] = Array.isArray(s.text)
    ? s.text
    : typeof s.text === 'string'
      ? [{ text: s.text }]
      : [s.text];
  return new Paragraph({
    alignment,
    spacing: { after: s.spaceAfter ?? 80 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          italics: r.italics,
          font: 'Times New Roman',
          size: 24,
        }),
    ),
  });
}

async function writeTemplate(
  fileName: string,
  paragraphs: ParaSpec[],
): Promise<void> {
  const doc = new Document({
    creator: 'raport-bot',
    sections: [
      { properties: {}, children: paragraphs.map(specToParagraph) },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  const out = path.join(OUT_DIR, fileName);
  await fs.writeFile(out, buffer);
  // eslint-disable-next-line no-console
  console.log(`✓ ${out}`);
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const def of TEMPLATES) {
    const variants = BUILDERS[def.code];
    if (!variants) {
      // eslint-disable-next-line no-console
      console.warn(`No builder for ${def.code}`);
      continue;
    }
    for (const loc of LOCALES) {
      await writeTemplate(`${def.fileNameBase}.${loc}.docx`, variants[loc]);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
