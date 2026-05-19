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
  Tab,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  type IParagraphOptions,
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
  /** Insert a `<w:tab/>` element BEFORE this run. Advances to the
   *  paragraph's `tabStop` (or the next default tab if unset). Useful for
   *  aligning content next to a fixed-position label. */
  tab?: boolean;
}

interface ParaSpec {
  text: string | RunSpec | RunSpec[];
  align?: Align;
  /** Space (twips) after this paragraph. Defaults to 80. Set 0 for tight
   *  packing within a body section. */
  spaceAfter?: number;
  /** First-line indent in twips (standard Russian/Uzbek formal letter
   *  body uses ~720 = 0.5 inch). */
  firstLine?: number;
  /** Whole-paragraph left indent in twips. Useful for visually grouping
   *  address/phone lines under their "Undiruvchi:" / "Qarzdor:" label. */
  leftIndent?: number;
  /** Tab stop position in twips. Combined with `tab: true` on a run to
   *  position content at a fixed column regardless of preceding label
   *  width (label width varies per locale, plain spaces are unreliable). */
  tabStop?: number;
  /** Right-aligned tab stop position (twips). When set together with
   *  `tabStop`, the paragraph gets two tab stops: a RIGHT one at this
   *  position (so a `<tab>Label` run renders the label's right edge AT
   *  this X) and a LEFT one at `tabStop` (so the next `<tab>FIO` run
   *  starts at `tabStop`). Used in party blocks to keep a constant
   *  ~2-space gap between label and FIO regardless of label width. */
  rightTabStop?: number;
  /** Hanging indent in twips. Combined with `leftIndent`, the FIRST
   *  line is offset to the left by this amount (effectively starts at
   *  `leftIndent - hanging`); subsequent wrapped lines stay at
   *  `leftIndent`. Used on party-block label paragraphs so that long
   *  FIOs / org names wrap underneath the FIO column instead of falling
   *  back to the page margin. */
  hanging?: number;
}

/** Side-by-side block: attachment section (header + bullet list) on the
 *  left, QR-code image on the right — rendered as a borderless 2-cell
 *  table. Both columns share the row, so the QR no longer pushes the
 *  bullets down with a tall blank gap. */
interface SideQrSpec {
  kind: 'side-qr';
  paragraphs: ParaSpec[];
}

type BlockSpec = ParaSpec | SideQrSpec;

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

function transliterateBlock(b: BlockSpec): BlockSpec {
  if ('kind' in b && b.kind === 'side-qr') {
    return { ...b, paragraphs: b.paragraphs.map(transliteratePara) };
  }
  return transliteratePara(b);
}

function deriveLatin(cyrillic: BlockSpec[]): BlockSpec[] {
  return cyrillic.map(transliterateBlock);
}

// ============================================================
// Shared layout constants — used by every user-facing template so
// the four documents share the same printable-form look:
// header (right), party block shifted to the right column, justified
// body with first-line indent, signature gap, bold-italic attachment
// header and italic bullets.
// ============================================================
// Party block columns. The label sits in a right-aligned tab stop whose
// right edge is `LABEL_GAP` twips before `PARTY_INDENT`; the FIO sits in
// a left-aligned tab stop at `PARTY_INDENT`. Address/phone paragraphs
// reuse the same `PARTY_INDENT` as `leftIndent`. This way the gap
// between label end and FIO start is constant (~2 spaces) regardless of
// label width — varies from short "Қарздор:" to long "Заявитель
// (должник):" without misalignment.
const PARTY_INDENT = 5400;       // where FIO / address / phone column starts
const LABEL_GAP = 280;            // ~2-monospace-spaces gap between label and FIO
const PARTY_LABEL_RIGHT = PARTY_INDENT - LABEL_GAP; // right edge of label tab stop
const BODY_FIRSTLINE = 720;      // first-line indent for body paragraphs
const TIGHT = 0;                 // no extra space below — within a body section
const SIGNATURE_GAP = '                 '; // visible gap for signature
const BLOCK_GAP = '        ';    // smaller gap between signature and FIO
// Header lines (`Фуқаролик ишлари бўйича {court}` / `туманлараро суди
// раиси {judge}га`) both start at this X so their left edges line up
// with the FIO column below — visually it looks like one block.
const HEADER_INDENT = PARTY_INDENT;

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

const T2_CY: BlockSpec[] = [
  // ── Header ──
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Plaintiff (Аризачи) block — right-shifted; FIO/address/phone in
  //     a column aligned by tab stop + matching leftIndent. ──
  {
    text: [
      { text: 'Аризачи:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Defendant (Жавобгар) block ──
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{defendant_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{defendant_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{defendant_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Title ──
  { text: [{ text: 'ДАЪВО АРИЗА', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(АЛИМЕНТ МИҚДОРИНИ КАМАЙТИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body (long single paragraph, justified, with first-line indent). ──
  {
    text: 'Биринчи турмуш ўртоғи {{first_spouse_fio}} билан биргаликдаги турмушларимиздан {{first_children_count}} нафар фарзандмиз бор, фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{first_order_year}} йил {{first_order_month}} ойининг {{first_order_day}} кунидаги суд буйруғига асосан {{first_children_count}} нафар фарзандимнинг таъминоти учун ойлик иш ҳақи ва бошқа даромадининг {{first_alimony_share}} қисми миқдорида алимент ундирилган, жавобгар (иккинчи турмуш ўртоғим) {{second_spouse_fio}} билан биргаликдаги турмушмиздан {{second_children_count}} нафар фарзандмиз бор, судининг {{second_order_year}} йил {{second_order_month}} ойининг {{second_order_day}} кунидаги суд буйруғига асосан фарзандларининг таъминоти учун ойлик иш ҳақи ва бошқа даромадининг {{second_alimony_share}} қисми миқдорида алимент ундириш белгиланган, ҳозирги кунда юқоридаги суд қарорларига асосан иккала оиламда бўлган {{total_children_count}} нафар фарзандларимнинг таъминоти учун тўланадиган алиментларнинг миқдори қонунда {{total_children_count}} нафар фарзандлар учун ундирилиши белгиланган алимент миқдоридан ошиб кетган, ушбу суд қарорлари бўйича ундирилиши лозим бўлган алимент миқдорларини қонунга мувофиқлаштириб, {{first_spouse_fio}} ва {{second_spouse_fio}}ларга ундирилаётган алимент миқдорини қонунда белгиланган тартибда камайтиришни сўрайман.',
    align: 'justify',
    firstLine: BODY_FIRSTLINE,
  },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Аризачи:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '' },
  // ── Attachment header (bold + italic) + italic bullet list ──
  { text: [{ text: 'Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Даъво ариза икки нусхада;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Суд буйруқлари;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Суд буйруқлари бўйича ижро иши қўзғатилганлиги тўғрисида МИБ қарори;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Никоҳ тузилганлиги ҳақидаги гувоҳнома асли;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Давлат божи ва почта ҳаражати тўланганлиги тўғрисидаги патта.', italics: true }] },
];

const T2_RU: BlockSpec[] = [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Заявитель:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{defendant_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{defendant_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{defendant_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  { text: [{ text: 'ИСКОВОЕ ЗАЯВЛЕНИЕ', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(ОБ УМЕНЬШЕНИИ РАЗМЕРА АЛИМЕНТОВ)', italics: true }], align: 'center' },
  { text: '' },
  {
    text: 'От совместной жизни с первым супругом(ой) {{first_spouse_fio}} имеется {{first_children_count}} ребёнок(ков); на основании судебного приказа межрайонного суда по гражданским делам {{court_name}} от {{first_order_day}} {{first_order_month}} {{first_order_year}} года с меня взыскиваются алименты в размере {{first_alimony_share}} от заработной платы и иных доходов на содержание {{first_children_count}} ребёнка(детей). От совместной жизни со вторым супругом(ой) — ответчиком — {{second_spouse_fio}} имеется {{second_children_count}} ребёнок(ков); на основании судебного приказа от {{second_order_day}} {{second_order_month}} {{second_order_year}} года установлено взыскание алиментов в размере {{second_alimony_share}} от заработной платы и иных доходов. В настоящее время общая сумма взыскиваемых алиментов на {{total_children_count}} детей превышает размер, установленный законом для {{total_children_count}} детей. Прошу привести взыскиваемые суммы в соответствие с законом и уменьшить размер алиментов, взыскиваемых в пользу {{first_spouse_fio}} и {{second_spouse_fio}}.',
    align: 'justify',
    firstLine: BODY_FIRSTLINE,
  },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Заявитель:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '' },
  { text: [{ text: 'К исковому заявлению должны быть приложены следующие документы.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Исковое заявление в двух экземплярах;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Судебные приказы;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Постановление БПИ о возбуждении исполнительного производства по судебным приказам;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Оригинал свидетельства о заключении брака;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копия свидетельства о рождении детей;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Квитанция об уплате госпошлины и почтовых расходов.', italics: true }] },
];

/* ============================================================
 * Template 3 — Даъво ариза (Ёшгача таъминот)
 * ============================================================ */

const T3_CY: BlockSpec[] = [
  // ── Header ──
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Plaintiff (Аризачи) ──
  {
    text: [
      { text: 'Аризачи:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Defendant (Жавобгар) ──
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{defendant_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{defendant_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{defendant_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Title ──
  { text: [{ text: 'ДАЪВО АРИЗА', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(ЁШГАЧА ТАЪМИНОТ УНДИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body — tight, first-line indent. marriage_date uses split y/m/d;
  //     separation_date uses split year/month; children_block aggregates
  //     per-child info. ──
  { text: 'Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} кунида қонуний никоҳдан ўтиб турмуш қурганмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Жавобгар билан ўзаро келишмовчиликлар оқибатида {{separation_year}} йил {{separation_month}} ойидан буён бирга яшамаяпмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Вояга етмаган бола(лар)га алимент тўлаш ҳақида ўртамизда келишув йўқ ва қарздор ихтиёрий фарзанд(лар)им таъминоти билан шуғулланмасдан келмоқда.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Шу сабабли Сиздан фарзанд(лар)им туғилган кундан эътиборан уч йил давомида қонунда белгиланган тартиб ва миқдорда {{amount}} сўм таъминот ундириб беришингизни сўрайман.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Аризачи:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '' },
  { text: [{ text: 'Аризага қуйидаги ҳужжатлар илова қилиниши лозим.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Даъво ариза икки нусхада;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Тарафларнинг паспорт нусхалари;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Никоҳ тузилганлиги ҳақидаги гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Фарзанд(лар) туғилганлик ҳақидаги гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Почта ҳаражати тўланганлиги тўғрисидаги патта.', italics: true }] },
];

const T3_RU: BlockSpec[] = [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Заявитель:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{defendant_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{defendant_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{defendant_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  { text: [{ text: 'ИСКОВОЕ ЗАЯВЛЕНИЕ', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(О ВЗЫСКАНИИ СОДЕРЖАНИЯ ДО СОВЕРШЕННОЛЕТИЯ)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'Я, {{plaintiff_fio}}, и ответчик {{defendant_fio}} заключили законный брак {{marriage_day}} {{marriage_month}} {{marriage_year}} года.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Вследствие разногласий с ответчиком мы не проживаем совместно с {{separation_month}} {{separation_year}} года.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Соглашения об уплате алиментов между нами нет, и должник добровольно не содержит ребёнка(детей).', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'В связи с этим прошу взыскать с ответчика в установленном законом порядке и размере содержание в сумме {{amount}} сум на ребёнка(детей) в течение трёх лет с момента рождения.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Заявитель:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '' },
  { text: [{ text: 'К заявлению должны быть приложены следующие документы.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Исковое заявление в двух экземплярах;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копии паспортов сторон;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копия свидетельства о браке;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копия свидетельства о рождении детей;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Квитанция об оплате почтовых расходов.', italics: true }] },
];

/* ============================================================
 * Template 4 — Ариза (Алимент ундириш)
 * ============================================================ */

const T4_CY: BlockSpec[] = [
  // ── Header (right-aligned, bold italic) — both lines end at the
  //     right margin so the trailing edge aligns with the justified
  //     body text below. ──
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Undiruvchi / Qarzdor blocks: whole block shifted right; label
  //     and content sit in two stacked columns on the right side of the
  //     page. Tab stop on the label line aligns the FIO with the rest
  //     of the content paragraphs below. ──
  {
    text: [
      { text: 'Ундирувчи:', bold: true, tab: true },
      { text: '{{collector_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{collector_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{collector_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{collector_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Қарздор:', bold: true, tab: true },
      { text: '{{debtor_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{debtor_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{debtor_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{debtor_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Title ──
  { text: [{ text: 'А Р И З А', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(АЛИМЕНТ УНДИРИШ ҲАҚИДА)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body: first-line indented sentences, packed tight (no vertical gap
  //     between them — matches the sample's letter style). ──
  { text: 'Мен {{collector_fio}} қарздор {{debtor_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} кунида қонуний никоҳдан ўтиб турмуш қурганмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Қарздор билан ўзаро келишмовчиликлар оқибатида {{separation_year}} йил {{separation_month}} ойидан буён бирга яшамаяпмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Вояга етмаган бола(лар)га алимент тўлаш ҳақида ўртамизда келишув йўқ ва қарздор ихтиёрий фарзанд(лар)им таъминоти билан шуғулланмасдан келмоқда.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Шу сабабли Сиздан фарзанд(лар)им таъминоти учун алимент ундириш ҳақида суд буйруғи чиқаришингизни сўрайман.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Аризачи:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{collector_fio}}', bold: true },
  ] },
  { text: '' },
  // ── Attachment header (bold + italic) and bullet list (italic) —
  //     matches the sample form. ──
  { text: [{ text: 'Аризага қуйидаги ҳужжатлар илова қилиниши лозим.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Ариза икки нусхада;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Тарафларнинг паспорт нусхалари;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Никоҳ тузилганлиги ҳақидаги гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Почта харажати тўланганлиги тўғрисидаги патта.', italics: true }] },
];

const T4_RU: BlockSpec[] = [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Взыскатель:', bold: true, tab: true },
      { text: '{{collector_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{collector_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{collector_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{collector_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Должник:', bold: true, tab: true },
      { text: '{{debtor_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{debtor_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{debtor_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{debtor_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  { text: [{ text: 'З А Я В Л Е Н И Е', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(О ВЗЫСКАНИИ АЛИМЕНТОВ)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'Я, {{collector_fio}}, и должник {{debtor_fio}} заключили законный брак {{marriage_day}} {{marriage_month}} {{marriage_year}} года.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Вследствие разногласий с должником мы не проживаем совместно с {{separation_month}} {{separation_year}} года.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Соглашения об уплате алиментов между нами нет, и должник добровольно не содержит ребёнка(детей).', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'В связи с этим прошу вынести судебный приказ о взыскании алиментов на содержание моего(их) ребёнка(детей).', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Заявитель:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{collector_fio}}', bold: true },
  ] },
  { text: '' },
  { text: [{ text: 'К заявлению должны быть приложены следующие документы.', bold: true, italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Заявление в двух экземплярах;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копии паспортов сторон;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копия свидетельства о браке;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Копия свидетельства о рождении детей;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '-Квитанция об оплате почтовых расходов.', italics: true }] },
];

/* ============================================================
 * Template 5 — Эътирознома (савдо дўкони)
 * ============================================================ */

const T5_CY: BlockSpec[] = [
  // ── Header ──
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Single party block — Аризачи (қарздор). Note: longer label so we
  //     bump the leftIndent slightly for the label line; content column
  //     stays at PARTY_INDENT for consistency. ──
  {
    text: [
      { text: 'Аризачи (қарздор):', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Title ──
  { text: [{ text: 'Э Ъ Т И Р О З Н О М А', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(Ўтказиб юборилган муддатни узрли деб топиб, суд буйруғини бекор қилиш тўғрисида)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body ──
  { text: '{{order_year}} йил {{order_month}} ойининг {{order_day}} санасида фуқаролик ишлари бўйича {{court_name}} туманлараро суди _________________-сонли суд буйруғи билан ундирувчи {{creditor_name}} фойдасига қарздор мендан бадал пули ундириш бўйича чиқарилган суд буйруғи чиқарилган.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Суд буйруғидан {{order_year}} йил {{learned_month}} ойининг {{learned_day}} кунида хабар топдим.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Мен ушбу суд буйруғидан норозиман.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: [{ text: 'Эътироз сабаблари:', italics: true, bold: true }], spaceAfter: TIGHT },
  { text: '_______________________________________________________________________________', spaceAfter: TIGHT },
  { text: '_______________________________________________________________________________', spaceAfter: TIGHT },
  { text: 'Шу сабабли суд буйруғини кеч олганлигини инобатга олиб, ўтказиб юборилган муддатни узрли деб топиб, уни тиклашингизни ва суд буйруғини бекор қилишингизни сўрайман.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Иловалар:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Аризачи (қарздор)', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{plaintiff_short_fio}}', bold: true },
  ] },
];

const T5_RU: BlockSpec[] = [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Заявитель (должник):', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: '{{plaintiff_address_line1}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{plaintiff_address_line2}}', leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: 'Телефон: {{plaintiff_phone}}', leftIndent: PARTY_INDENT },
  { text: '' },
  { text: [{ text: 'В О З Р А Ж Е Н И Е', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(о признании пропущенного срока уважительным и об отмене судебного приказа)', italics: true }], align: 'center' },
  { text: '' },
  { text: '{{order_day}} {{order_month}} {{order_year}} года межрайонный суд по гражданским делам {{court_name}} вынес судебный приказ № _________________, согласно которому с меня — должника — в пользу взыскателя {{creditor_name}} взыскан членский взнос.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'О данном судебном приказе я узнал(а) {{learned_day}} {{learned_month}} {{order_year}} года.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Я не согласен(на) с указанным судебным приказом.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: [{ text: 'Причины возражения:', italics: true, bold: true }], spaceAfter: TIGHT },
  { text: '_______________________________________________________________________________', spaceAfter: TIGHT },
  { text: '_______________________________________________________________________________', spaceAfter: TIGHT },
  { text: 'В связи с поздним получением приказа прошу признать пропущенный срок уважительным, восстановить его и отменить судебный приказ.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Приложения:', bold: true }] },
  { text: '' },
  { text: [
    { text: 'Заявитель (должник)', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{plaintiff_short_fio}}', bold: true },
  ] },
];

/* ============================================================
 * Template 6 — Илтимоснома (Petition to hear case in absentia).
 * Same right-aligned header / party-block / body-with-firstLine
 * layout as the rest, but the plaintiff block content varies by
 * type (organisation vs natural person) — the script renders both
 * variants and `document.service.ts` pre-fills only the relevant
 * pre-built strings so the docx stays static.
 *
 * Variables filled by document.service for this template:
 *   plaintiff_subject       — org name OR FIO
 *   plaintiff_address_line1 / _line2
 *   plaintiff_phone
 *   plaintiff_id_line       — "СТИР: …" or "ЖШШИР: …"
 *   defendantN_fio / _address_line1 / _line2 / _phone / _pinfl   (N=1..3)
 *   defendantN_present      — boolean; controls {{#…}}…{{/…}} blocks
 *   damage_description / damage_amount / postal_expenses
 *   representative_fio
 *   contact_phone1 / contact_phone2
 *   defendants_in_body      — "жавобгарлар X ва Y дан" / "жавобгар X дан"
 * ============================================================ */

const T6_CY: BlockSpec[] = [
  // ── Header ──
  { text: [{ text: 'ФИБ {{court_name}} туманлараро суди судьяси', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Plaintiff (Даъвогар) block ──
  {
    text: [
      { text: 'Даъвогар:', bold: true, tab: true },
      { text: '{{plaintiff_subject}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Манзил: {{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{plaintiff_phone}}    {{plaintiff_id_line}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Defendants — up to MAX_DEFENDANTS=3, each block wrapped in a
  //    docxtemplater conditional. The standalone {{#…}} / {{/…}} tag
  //    paragraphs are removed by paragraphLoop:true and the contained
  //    paragraphs survive only when defendantN_present is truthy. ──
  { text: '{{#defendant1_present}}' },
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant1_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Манзили: {{defendant1_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant1_address_line2}}    Тел: {{defendant1_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ЖШШИР: {{defendant1_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant1_present}}' },
  { text: '{{#defendant2_present}}' },
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant2_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Манзили: {{defendant2_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant2_address_line2}}    Тел: {{defendant2_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ЖШШИР: {{defendant2_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant2_present}}' },
  { text: '{{#defendant3_present}}' },
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant3_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Манзили: {{defendant3_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant3_address_line2}}    Тел: {{defendant3_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ЖШШИР: {{defendant3_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant3_present}}' },
  // ── Title ──
  { text: [{ text: 'Илтимоснома', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(аризани даъвогарнинг иштирокисиз кўриш ҳақида)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body ──
  { text: 'Иш юритувингизда даъвогар {{plaintiff_subject}}нинг {{defendants_in_body}} {{damage_amount}} сўм миқдорида {{damage_description}} зарарни ҳамда {{postal_expenses}} сўм почта харажатини ундириш ҳақида даъво аризаси бўйича иш кўрилмоқда.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: [
    { text: 'ФПКнинг ' },
    { text: '220-моддаси 4-қисмига кўра', bold: true },
    { text: ' Тарафлар ишни ўзининг иштирокисиз кўришни ва ўзларига суд ҳал қилув қарорининг кўчирма нусхасини юборишни илтимос қилишга ҳақли.' },
  ], align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Мазкур нормага биноан суддан,', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Даъвогар {{plaintiff_subject}}нинг {{defendants_in_body}} {{damage_amount}} сўм миқдорида {{damage_description}} зарарни ҳамда {{postal_expenses}} сўм почта харажатини ундириш ҳақида аризасини даъвогарнинг иштирокисиз кўриб чиқишни;', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'арз талабини тўлиқ қаноатлантиришни;', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'агарда ишнинг ҳолатлари бўйича суд мажлисида даъвогар иштирок этиши шарт деб топилган тақдирда {{contact_phone1}} ёки {{contact_phone2}} телефон рақамлари орқали хабар беришни сўрайман.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Илова:', bold: true }, { text: ' Вакилнинг ишончномаси нусхаси.' }] },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Даъвогарнинг ишончнома орқали вакили', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{representative_fio}}', bold: true },
  ] },
];

const T6_RU: BlockSpec[] = [
  { text: [{ text: 'Судье межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Истец:', bold: true, tab: true },
      { text: '{{plaintiff_subject}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Адрес: {{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{plaintiff_phone}}    {{plaintiff_id_line}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{#defendant1_present}}' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant1_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Адрес: {{defendant1_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant1_address_line2}}    Тел: {{defendant1_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ПИНФЛ: {{defendant1_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant1_present}}' },
  { text: '{{#defendant2_present}}' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant2_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Адрес: {{defendant2_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant2_address_line2}}    Тел: {{defendant2_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ПИНФЛ: {{defendant2_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant2_present}}' },
  { text: '{{#defendant3_present}}' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant3_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: 'Адрес: {{defendant3_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant3_address_line2}}    Тел: {{defendant3_phone}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'ПИНФЛ: {{defendant3_pinfl}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: '{{/defendant3_present}}' },
  { text: [{ text: 'ХОДАТАЙСТВО', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(о рассмотрении дела в отсутствие истца)', italics: true }], align: 'center' },
  { text: '' },
  { text: 'В Вашем производстве находится дело по иску {{plaintiff_subject}} к {{defendants_in_body}} о взыскании {{damage_amount}} сум {{damage_description}} ущерба, а также {{postal_expenses}} сум почтовых расходов.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: [
    { text: 'Согласно ' },
    { text: 'части 4 статьи 220 ГПК', bold: true },
    { text: ' стороны вправе ходатайствовать о рассмотрении дела без их участия и направлении им копии судебного решения.' },
  ], align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'На основании указанной нормы прошу суд:', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Рассмотреть исковое заявление истца {{plaintiff_subject}} к {{defendants_in_body}} о взыскании {{damage_amount}} сум {{damage_description}} ущерба и {{postal_expenses}} сум почтовых расходов в отсутствие истца;', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'удовлетворить исковые требования в полном объёме;', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'если по обстоятельствам дела суд сочтёт обязательным личное присутствие истца — известить по телефонам {{contact_phone1}} или {{contact_phone2}}.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Приложение:', bold: true }, { text: ' копия доверенности представителя.' }] },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Представитель истца по доверенности', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{representative_fio}}', bold: true },
  ] },
];

/* ============================================================
 * Template 7 — Даъво ариза (Никоҳдан ажратиш ҳақида).
 * Civil suit for divorce when one spouse refuses or there are minor
 * children. Uses standard party-block layout; the body weaves in
 * marriage registration details (FXDYO branch + act number) and a
 * free-form "reasons" paragraph the user fills out themselves.
 * ============================================================ */

const T7_CY: BlockSpec[] = [
  // ── Header ──
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  // ── Plaintiff (Даъвогар) ──
  {
    text: [
      { text: 'Даъвогар:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{plaintiff_phone}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Defendant (Жавобгар) ──
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{defendant_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{defendant_phone}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  // ── Title ──
  { text: [{ text: 'Д А Ъ В О   А Р И З А', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(Никоҳдан ажратиш ҳақида)', italics: true }], align: 'center' },
  { text: '' },
  // ── Body ──
  { text: 'Мен жавобгар {{defendant_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} куни қонуний никоҳдан ўтиб, турмуш қурганмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Никоҳимиз {{marriage_registry_office}} ФХДЁ бўлимида {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} куни {{marriage_act_number}}-сон билан қайд этилган.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{divorce_reasons}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Жавобгар билан {{separation_year}} йил {{separation_month}} ойидан буён бирга яшамаяпмиз.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Юқоридагиларга ва амалдаги Ўзбекистон Республикаси Оила Кодексининг 40-41-моддаларига асосан,', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'С Ў Р А Й М А Н', bold: true }], align: 'center' },
  { text: '' },
  { text: 'Жавобгар {{defendant_fio}} билан {{marriage_registry_office}} ФХДЁ бўлимида {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} куни {{marriage_act_number}}-сон билан қайд этилган никоҳимиздан ажратишингизни.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  // ── Attachments ──
  { text: [{ text: 'Илова:', bold: true }] },
  { text: [{ text: '- Паспортимни нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Никоҳ гувоҳномаси асли;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Туғилганлик гувоҳнома нусхаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- МФЙ далолатномаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Давлат божи тўлови ва почта харажати патти.', italics: true }] },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Даъвогар:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
];

const T7_RU: BlockSpec[] = [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Истец:', bold: true, tab: true },
      { text: '{{plaintiff_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{plaintiff_phone}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant_fio}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{defendant_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'Тел: {{defendant_phone}}', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  { text: [{ text: 'И С К О В О Е   З А Я В Л Е Н И Е', bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: '(о расторжении брака)', italics: true }], align: 'center' },
  { text: '' },
  { text: '{{marriage_day}} {{marriage_month}} {{marriage_year}} года я вступил(а) в законный брак с ответчиком {{defendant_fio}}.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'Наш брак зарегистрирован в органе ЗАГС {{marriage_registry_office}} {{marriage_day}} {{marriage_month}} {{marriage_year}} года, актовая запись № {{marriage_act_number}}.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{children_block}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: '{{divorce_reasons}}', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'С {{separation_month}} {{separation_year}} года мы с ответчиком совместно не проживаем.', align: 'justify', firstLine: BODY_FIRSTLINE, spaceAfter: TIGHT },
  { text: 'На основании изложенного и в соответствии со ст. 40-41 Семейного кодекса Республики Узбекистан,', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'П Р О Ш У', bold: true }], align: 'center' },
  { text: '' },
  { text: 'Расторгнуть брак между мной и ответчиком {{defendant_fio}}, зарегистрированный в органе ЗАГС {{marriage_registry_office}} {{marriage_day}} {{marriage_month}} {{marriage_year}} года, актовая запись № {{marriage_act_number}}.', align: 'justify', firstLine: BODY_FIRSTLINE },
  { text: '' },
  { text: [{ text: 'Приложение:', bold: true }] },
  { text: [{ text: '- копия паспорта истца;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- оригинал свидетельства о браке;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- копии свидетельств о рождении детей;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- справка из махалли;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- квитанция гос. пошлины и почтовых расходов.', italics: true }] },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Истец:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
];

/* ============================================================ */

// QR code is no longer embedded in the document — it's sent as a
// separate photo after the file. Footer helpers/constants kept around
// the codebase have been removed.

const BUILDERS: Record<string, Record<Locale, BlockSpec[]>> = {
  'etirozhoma-sud-buyrugi': {
    uz_cyrillic: T1_CY,
    uz_latin: deriveLatin(T1_CY),
    ru: T1_RU,
  },
  'davo-ariza-aliment-kamaytirish': {
    uz_cyrillic: T2_CY,
    uz_latin: deriveLatin(T2_CY),
    ru: T2_RU,
  },
  'davo-ariza-yoshgacha-taminot': {
    uz_cyrillic: T3_CY,
    uz_latin: deriveLatin(T3_CY),
    ru: T3_RU,
  },
  'ariza-aliment-undirish': {
    uz_cyrillic: T4_CY,
    uz_latin: deriveLatin(T4_CY),
    ru: T4_RU,
  },
  'etirozhoma-savdo': {
    uz_cyrillic: T5_CY,
    uz_latin: deriveLatin(T5_CY),
    ru: T5_RU,
  },
  'iltimosnoma-ishtiroksiz': {
    uz_cyrillic: T6_CY,
    uz_latin: deriveLatin(T6_CY),
    ru: T6_RU,
  },
  'davo-ariza-nikohdan-ajratish': {
    uz_cyrillic: T7_CY,
    uz_latin: deriveLatin(T7_CY),
    ru: T7_RU,
  },
};

/* ============================================================ */

function runToChildren(r: RunSpec): TextRun[] {
  const out: TextRun[] = [];
  if (r.tab) {
    out.push(new TextRun({ children: [new Tab()] }));
  }
  out.push(
    new TextRun({
      text: r.text,
      bold: r.bold,
      italics: r.italics,
      font: 'Times New Roman',
      size: 24,
    }),
  );
  return out;
}

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
  const indent =
    s.firstLine !== undefined ||
    s.leftIndent !== undefined ||
    s.hanging !== undefined
      ? {
          ...(s.firstLine !== undefined ? { firstLine: s.firstLine } : {}),
          ...(s.leftIndent !== undefined ? { left: s.leftIndent } : {}),
          ...(s.hanging !== undefined ? { hanging: s.hanging } : {}),
        }
      : undefined;
  const opts: IParagraphOptions = {
    alignment,
    spacing: { after: s.spaceAfter ?? 80 },
    ...(indent ? { indent } : {}),
    ...(s.tabStop !== undefined || s.rightTabStop !== undefined
      ? {
          tabStops: [
            ...(s.rightTabStop !== undefined
              ? [{ type: TabStopType.RIGHT, position: s.rightTabStop }]
              : []),
            ...(s.tabStop !== undefined
              ? [{ type: TabStopType.LEFT, position: s.tabStop }]
              : []),
          ],
        }
      : {}),
    children: runs.flatMap(runToChildren),
  };
  return new Paragraph(opts);
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const HIDDEN_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

/** Render a SideQrSpec as a borderless 2-cell table: the supplied
 *  paragraphs (attachment header + bullet list) live in the LEFT cell,
 *  `{{%qr_code}}` sits in the RIGHT cell. Sharing the row means the QR
 *  no longer creates a tall blank gap above the bullets. */
function sideQrToTable(s: SideQrSpec): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: HIDDEN_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 90, type: WidthType.PERCENTAGE },
            borders: HIDDEN_BORDERS,
            children: s.paragraphs.map(specToParagraph),
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: HIDDEN_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: '{{%qr_code}}',
                    font: 'Times New Roman',
                    size: 24,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function blockToChild(b: BlockSpec): Paragraph | Table {
  if ('kind' in b && b.kind === 'side-qr') return sideQrToTable(b);
  return specToParagraph(b);
}

async function writeTemplate(
  fileName: string,
  blocks: BlockSpec[],
): Promise<void> {
  const doc = new Document({
    creator: 'raport-bot',
    sections: [
      {
        // Narrower left/right margins (≈0.76") give the body more
        // horizontal space and reduce the large blank margins the user
        // was seeing on the page. Top/bottom kept at the default 1".
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1100,
              bottom: 1440,
              left: 1100,
            },
          },
        },
        children: blocks.map(blockToChild),
      },
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
