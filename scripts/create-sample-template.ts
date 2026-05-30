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

/* ============================================================
 * Helpers for the bulk-added civil-suit templates (T8..T20).
 * They share the same header / party-block / signature shapes,
 * so factor them into small builders to keep each template's
 * BlockSpec list focused on its own body text and attachment list.
 * ============================================================ */

const stdHeaderCY = (): BlockSpec[] => [
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'туманлараро суди раиси {{judge_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const stdHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'Председателю межрайонного суда по гражданским делам {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{judge_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

/** Appellate-style header: addressed to the regional appellate /
 *  review / cassation panel, with a reference line citing the
 *  district-court ruling being challenged. */
const appellateHeaderCY = (instance: 'апелляция' | 'тафтиш' | 'кассация'): BlockSpec[] => [
  { text: [{ text: `{{court_name}} вилоят суди фуқаролик ишлари бўйича ${instance} инстанцияси судлов ҳайъатига`, bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: '' },
  { text: [{ text: 'Фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{ruling_year}} йил {{ruling_month}} ойининг {{ruling_day}} кунидаги ҳал қилув қарорига нисбатан', italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const appellateHeaderRU = (instance: 'апелляционная' | 'надзорная' | 'кассационная'): BlockSpec[] => [
  { text: [{ text: `В ${instance} инстанцию по гражданским делам областного суда {{court_name}}`, bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: '' },
  { text: [{ text: 'на решение межрайонного суда по гражданским делам {{court_name}} от {{ruling_day}} {{ruling_month}} {{ruling_year}} года', italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const partyBlockCY = (label: string, base: string, fioVar = `${base}_fio`): BlockSpec[] => [
  {
    text: [
      { text: `${label}:`, bold: true, tab: true },
      { text: `{{${fioVar}}}`, tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: `{{${base}_address_line1}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: `{{${base}_address_line2}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: `Тел: {{${base}_phone}}`, italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
];

const partyBlockRU = (label: string, base: string, fioVar = `${base}_fio`): BlockSpec[] => [
  {
    text: [
      { text: `${label}:`, bold: true, tab: true },
      { text: `{{${fioVar}}}`, tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: `{{${base}_address_line1}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: `{{${base}_address_line2}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: `Тел: {{${base}_phone}}`, italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
];

const titleBlock = (title: string, subtitle: string): BlockSpec[] => [
  { text: [{ text: title, bold: true }], align: 'center', spaceAfter: TIGHT },
  { text: [{ text: `(${subtitle})`, italics: true }], align: 'center' },
  { text: '' },
];

const signatureBlock = (label: string, fioVar = 'plaintiff_fio'): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: label, bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: `{{${fioVar}}}`, bold: true },
  ] },
];

const signatureBlockRU = (label: string, fioVar = 'plaintiff_fio'): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: label, bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: `{{${fioVar}}}`, bold: true },
  ] },
];

const attachmentBlock = (header: string, items: string[]): BlockSpec[] => [
  { text: [{ text: header, bold: true }] },
  ...items.map<BlockSpec>((it) => ({
    text: [{ text: `- ${it}`, italics: true }],
    spaceAfter: TIGHT,
  })),
];

// Body paragraph factory — most of the new templates have justified
// body paragraphs with first-line indent and tight spacing.
const body = (text: string): BlockSpec => ({
  text,
  align: 'justify',
  firstLine: BODY_FIRSTLINE,
  spaceAfter: TIGHT,
});

const bodyRuns = (runs: RunSpec[]): BlockSpec => ({
  text: runs,
  align: 'justify',
  firstLine: BODY_FIRSTLINE,
  spaceAfter: TIGHT,
});

/* ============================================================
 * Template 8 — Оталикни белгилаш + алимент
 * ============================================================ */
const T8_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Оталикни белгилаш ва алимент ундириш ҳақида'),
  body('Мен даъвогар {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{shariy_marriage_year}} йилда шаърий никоҳ асосида турмуш қурганман, биргаликдаги турмушларимиздан бир нафар {{child_year}} йил {{child_month}} ойининг {{child_day}} кунида туғилган {{child_fio}} исмли фарзанди бор.'),
  body('Биз ўзаро шаърий никоҳларидан кейин {{cohabitation_address}} умумий рўзғор юритганмиз.'),
  body('Бизлар ўртамизда қонуний никоҳ бўлмаганлиги сабабли туғилган болага нисбатан у ўзимнинг фамилиямни берганман. Жавобгар кейинчалик ҳам фарзандига ихтиёрий равишда оталигини белгилаш ҳақида ФХДЁ бўлимига мурожаат қилмагани ва фарзандига таъминот кўрсатмасдан келгани учун у судга мурожаат қилишга мажбур бўлдим.'),
  body('Эр-хотинлик муносабатларида бир оила бўлиб яшаб келгани, маҳалла томонидан берилган далолатнома билан ўз тасдиғини топади.'),
  body('{{paternity_reasons}}'),
  body('Шу сабабли жавобгар {{defendant_fio}}нинг {{child_year}} йил {{child_month}} ойининг {{child_day}} кунида туғилган {{child_fio}}га нисбатан оталигини белгилаб, алимент ундиришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'Маҳалла фуқаролар йиғини далолатномаси ва бошқа далиллар;',
    'Тарафларнинг паспорт нусхалари;',
    'Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;',
    'почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
];

const T8_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'об установлении отцовства и взыскании алиментов'),
  body('Я, истец {{plaintiff_fio}}, состоял(а) с ответчиком {{defendant_fio}} в фактических брачных отношениях с {{shariy_marriage_year}} года; от совместной жизни имеется один ребёнок — {{child_fio}}, {{child_day}} {{child_month}} {{child_year}} года рождения.'),
  body('Совместно проживали по адресу: {{cohabitation_address}}.'),
  body('Поскольку наш брак не был зарегистрирован, ребёнку присвоена моя фамилия. Ответчик отказался добровольно установить отцовство в органе ЗАГС и не предоставляет средств на содержание ребёнка.'),
  body('Совместное проживание в качестве супругов подтверждается справкой махалли.'),
  body('{{paternity_reasons}}'),
  body('На основании изложенного прошу установить отцовство ответчика {{defendant_fio}} в отношении ребёнка {{child_fio}}, {{child_day}} {{child_month}} {{child_year}} года рождения, и взыскать с него алименты.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'справка из махалли и иные доказательства;',
    'копии паспортов сторон;',
    'копия свидетельства о рождении ребёнка;',
    'квитанция почтовых расходов.',
  ]),
];

/* ============================================================
 * Template 9 — Болани олиш
 * ============================================================ */
const T9_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Болани олиш ҳақида'),
  body('Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} кунида қонуний никоҳдан ўтиб турмуш қурганмиз.'),
  body('Биргаликдаги турмушимиздан {{children_count}} нафар фарзандимиз бор. Шу жумладан, {{requested_child_year}} йил {{requested_child_month}} ойининг {{requested_child_day}} кунида туғилган {{requested_child_fio}}.'),
  body('{{custody_reasons}}'),
  body('Жавобгар билан ўзаро келишмовчиликлар оқибатида {{separation_year}} йил {{separation_month}} ойидан буён бирга яшамаяпмиз. Жавобгар билан бошқа бир оила бўлиб яшашнинг имкони қолмаган.'),
  body('Жавобгар боламни асоссиз равишда ушлаб турмоқда.'),
  body('Шу сабабли суддан жавобгардан {{requested_child_year}} йил {{requested_child_month}} ойининг {{requested_child_day}} кунида туғилган {{requested_child_fio}}ни менинг тарбимга олиб беришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'Тарафларнинг паспорт нусхалари;',
    'Никоҳ тузилганлиги ҳақидаги гувоҳнома асли;',
    'Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;',
    'Никоҳдан ажратиш учун асос ҳисоблаётган ҳужжатлар (мавжуд бўлса);',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
];

const T9_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о передаче ребёнка на воспитание'),
  body('Я, {{plaintiff_fio}}, вступил(а) в брак с ответчиком {{defendant_fio}} {{marriage_day}} {{marriage_month}} {{marriage_year}} года.'),
  body('От совместной жизни имеется {{children_count}} ребёнок (детей), в том числе — {{requested_child_fio}}, {{requested_child_day}} {{requested_child_month}} {{requested_child_year}} года рождения.'),
  body('{{custody_reasons}}'),
  body('С {{separation_month}} {{separation_year}} года совместно с ответчиком не проживаем; совместная семейная жизнь невозможна.'),
  body('Ответчик без законных оснований удерживает ребёнка.'),
  body('На основании изложенного прошу передать на моё воспитание ребёнка {{requested_child_fio}}, {{requested_child_day}} {{requested_child_month}} {{requested_child_year}} года рождения.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'копии паспортов сторон;',
    'оригинал свидетельства о браке;',
    'копии свидетельств о рождении детей;',
    'документы об основаниях развода (при наличии);',
    'квитанция гос. пошлины и почтовых расходов.',
  ]),
];

/* ============================================================
 * Template 10 — Уй-жойга киритиш
 * ============================================================ */
const T10_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Уй-жойга киритиш ҳақида'),
  body('Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} кунида қонуний никоҳдан ўтиб турмуш қурганмиз.'),
  body('Биргаликдаги турмушимиздан {{children_count}} нафар фарзандимиз бор.'),
  body('{{leaving_reasons}}'),
  body('Менинг бошқа турар жойим мавжуд эмас. Мен ва фарзандларимнинг шу уй-жойда яшаш ҳуқуқимиз бор.'),
  body('Шу сабабли суддан мени вояга етмаган фарзандларим билан биргаликда {{housing_address}}га келин бўлиб тушган хонасига киритиб қўйишингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'Уй-жой кадастр ҳужжати;',
    'Тарафларнинг паспорт нусхалари;',
    'Никоҳ тузилганлиги ҳақидаги гувоҳнома асли;',
    'Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
];

const T10_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о допуске в жилище'),
  body('Я, {{plaintiff_fio}}, вступил(а) в брак с ответчиком {{defendant_fio}} {{marriage_day}} {{marriage_month}} {{marriage_year}} года.'),
  body('От совместной жизни имеется {{children_count}} ребёнок (детей).'),
  body('{{leaving_reasons}}'),
  body('Иного жилья у меня нет. Я и мои дети имеем право проживать в указанном жилище.'),
  body('Прошу суд впустить меня вместе с несовершеннолетними детьми в комнату, выделенную нам как невестке, по адресу: {{housing_address}}.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'кадастровый документ на жильё;',
    'копии паспортов сторон;',
    'оригинал свидетельства о браке;',
    'копии свидетельств о рождении детей;',
    'квитанция гос. пошлины и почтовых расходов.',
  ]),
];

/* ============================================================
 * Template 11 — Уй-жойдан кўчириш
 * ============================================================ */
const T11_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Уй-жойдан кўчириш ҳақида'),
  body('Жиззах шаҳрида хусусий амалиёт билан шуғулланувчи нотариус {{notary_fio}} томонидан {{contract_year}} йил {{contract_month}} ойининг {{contract_day}} кунида расмийлаштирилган ва реестрга {{contract_number}}-сон билан қайд қилинган олди-сотди шартномасига кўра, {{property_address}}-жойни сотиб олганман. Мазкур турар жой Давлат кадастрлари палатасининг {{court_name}} вилоят бошқармаси томонидан {{contract_year}} йил {{contract_month}} ойининг {{contract_day}} кунида {{cadastre_number}}-сон билан менинг номимга давлат рўйхатидан ўтказилган.'),
  body('Бундай ҳолатда {{property_address}}-жойнинг мулкдори мен ҳисобланаман.'),
  body('Бироқ, жавобгарлар менга тегишли бўлган уй-жойдан чиқмасдан келишмоқда.'),
  body('Шу сабабли суддан жавобгарни оила аъзолари билан биргаликда менга тегишли бўлган {{property_address}}-жой чиқаришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'Уй-жой кадастр ҳужжати;',
    'Тарафларнинг паспорт нусхалари;',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
];

const T11_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о выселении из жилища'),
  body('По договору купли-продажи, удостоверенному нотариусом {{notary_fio}} {{contract_day}} {{contract_month}} {{contract_year}} года, реестровый № {{contract_number}}, мною приобретено жилое помещение по адресу: {{property_address}}. Право собственности зарегистрировано Гос. кадастровой палатой по {{court_name}} обл. {{contract_day}} {{contract_month}} {{contract_year}} года, № {{cadastre_number}}.'),
  body('Следовательно, я являюсь собственником указанного жилья.'),
  body('Однако ответчик отказывается освободить принадлежащее мне жилое помещение.'),
  body('Прошу выселить ответчика вместе с членами его семьи из принадлежащего мне жилого помещения по адресу: {{property_address}}.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'кадастровый документ на жильё;',
    'копии паспортов сторон;',
    'квитанция гос. пошлины и почтовых расходов.',
  ]),
];

/* ============================================================
 * Template 12 — Мол-мулкни олиб бериш
 * ============================================================ */
const T12_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Мол-мулкни олиб бериш ҳақида'),
  body('Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{marriage_year}} йил {{marriage_month}} ойининг {{marriage_day}} кунида қонуний никоҳдан ўтиб турмуш қурганмиз.'),
  body('Биргаликдаги турмушимиздан {{children_count}} нафар фарзандимиз бор.'),
  body('Ўзаро келишмовчиликлар сабабли алоҳида-алоҳида яшаб келмоқдамиз, эндиликда бирга яшамоқчи эмасмиз. Аммо, жавобгар унга ҳаде ва бошқа асосларга кўра тегишли шахсий мол-мулкларимни олиб қолган ва ўз ихтиёри билан ушбу мол-мулкларимни бермасдан келмоқда.'),
  body('Қуйидаги мол-мулклар мен томонимга тегишли:'),
  body('{{property_list}}'),
  body('Шу сабабли суддан илова рўйхатида келтирилган мол-мулкларимни олиб беришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'Мол-мулклар рўйхати ва унинг тегишли ташкилотдан олинган бозор баҳоси тўғрисида маълумотнома ёки хулоса;',
    'Тарафларнинг паспорт нусхалари;',
    'Никоҳ тузилганлиги ҳақидаги гувоҳнома асли;',
    'Фарзандлар туғилганлик ҳақидаги гувоҳнома нусхаси;',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
  { text: [{ text: 'Изоҳ: Давлат божи мол-мулкнинг умумий баҳосининг 4 фоиз миқдорида тўланади.', italics: true }] },
];

const T12_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о возврате имущества'),
  body('Я, {{plaintiff_fio}}, состою(ял) в браке с ответчиком {{defendant_fio}} с {{marriage_day}} {{marriage_month}} {{marriage_year}} года.'),
  body('От совместной жизни имеется {{children_count}} ребёнок (детей).'),
  body('Вследствие разногласий мы проживаем раздельно, совместная жизнь невозможна. Однако ответчик удерживает у себя моё личное имущество и отказывается его возвращать.'),
  body('Указанное имущество принадлежит мне:'),
  body('{{property_list}}'),
  body('Прошу обязать ответчика возвратить перечисленное имущество.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'список имущества и справка о его рыночной стоимости;',
    'копии паспортов сторон;',
    'оригинал свидетельства о браке;',
    'копии свидетельств о рождении детей;',
    'квитанция гос. пошлины и почтовых расходов.',
  ]),
  { text: [{ text: 'Примечание: гос. пошлина — 4% от общей стоимости имущества.', italics: true }] },
];

/* ============================================================
 * Template 13 — Қарз ундириш (тилхат)
 * ============================================================ */
const T13_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Қарз ундириш ҳақида'),
  body('Мен {{plaintiff_fio}} жавобгар {{defendant_fio}} билан {{debt_year}} йилнинг {{debt_month}} ойида ўзаро қарз муносабатига киришганман ва шу муносабатларимиз юзасидан жавобгар мендан жами {{debt_amount}} сўм қарз бўлиб қолган. Бу тўғрисида жавобгарнинг ёзма тилхати мавжуд.'),
  body('Жавобгар томонидан ёзилган тилхатда мавжуд бўлган қарзни {{repayment_period}} муддат ичида тўлиқ қайтариб беришини баён қилган.'),
  body('Жавобгар тилхатида олинган қарзни қайтариб беришини баён қилган бўлса-да, бироқ қарздорликни бермасдан тилхатдаги мажбуриятини бажармасдан келмоқда.'),
  body('{{debt_circumstances}}'),
  body('Шу сабабли суддан жавобгардан {{debt_amount}} сўм қарзни ва тўланган суд харажатларини ундиришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'ёзма тилхат асли ёки унга қарз берувчи томонидан муайян сумма ёки муайян миқдордаги ашёлар топширилганлигини тасдиқлайдиган бошқа ҳужжат;',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта;',
    'Паспорт котияси.',
  ]),
  { text: [{ text: 'Изоҳ: Давлат божи қарз миқдорининг умумий баҳосидан 4 фоиз миқдорида тўланади.', italics: true }] },
];

const T13_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о взыскании долга'),
  body('Я, {{plaintiff_fio}}, в {{debt_month}} {{debt_year}} года вступил(а) в долговые отношения с ответчиком {{defendant_fio}}, по которым ответчик остался должен {{debt_amount}} сум. В подтверждение имеется собственноручно написанная им расписка.'),
  body('По расписке ответчик обязался вернуть долг в течение {{repayment_period}}.'),
  body('Несмотря на письменное обязательство, ответчик долг не возвращает.'),
  body('{{debt_circumstances}}'),
  body('Прошу взыскать с ответчика {{debt_amount}} сум долга и уплаченные судебные расходы.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'оригинал расписки или иной документ, подтверждающий получение средств / имущества;',
    'квитанция гос. пошлины и почтовых расходов;',
    'копия паспорта.',
  ]),
  { text: [{ text: 'Примечание: гос. пошлина — 4% от суммы долга.', italics: true }] },
];

/* ============================================================
 * Template 14 — Пул(қарз) ундириш — алдов
 * ============================================================ */
const T14_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  ...partyBlockCY('Жавобгар', 'defendant'),
  ...titleBlock('Д А Ъ В О   А Р И З А', 'Пул(қарз) ундириш ҳақида'),
  body('Менга олдиндан таниш бўлган (бўлмаган) жавобгар {{defendant_fio}} {{debt_year}} йилнинг {{debt_month}} ойларида жами {{debt_amount}} сўм қийматидаги {{debt_goods}}ни қарзга олган, бироқ жавобгар мени алдаб кетди.'),
  body('Берган нарсаларнинг пулларни қайтаришни сўраган вақтимда жавобгар уни қайтариб юборди. Кейинчалик ҳам унга бир неча бор учрашдим, аммо фойдаси бўлмади. Жавобгар олган нарса пулини "эртага-индин бераман" деб қочиб юрибди.'),
  body('Жавобгар пулларни қайтариб бермагандан кейин ИИБ ариза билан мурожаат қилдим. ИИБ томонидан "Жиноят ишини қўзғатишни рад қилиш тўғрисида"ги қарорига асосан жавобгарнинг ҳаракатларида жиноят аломатлари аниқланмаганлиги сабабли Ўзбекистон Республикаси ЖПКнинг 83-моддаси 2-қисмига асосан жиноят ишини қўзғатишни рад қилинди.'),
  body('Жавобгар ИИБ бошлиғи номига тушунтириш ёзиб, унда ҳақиқатдан ҳам ундан қарз эканлигини тан олган.'),
  body('{{iib_details}}'),
  body('Шу сабабли суддан жавобгардан {{debt_amount}} сўм қарзни ва тўланган суд харажатларини ундиришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  ...attachmentBlock('Даъво аризага қуйидаги ҳужжатлар илова қилиниши лозим.', [
    'Даъво ариза икки нусхада;',
    'ИИБ қарори ва тушунтириш хатлари;',
    'Давлат божи ва почта харажати тўланганлиги тўғрисидаги патта;',
    'Паспорт нусхаси.',
  ]),
  { text: [{ text: 'Изоҳ: Давлат божи пул (қарз) миқдорининг умумий баҳосидан 4 фоиз миқдорида тўланади.', italics: true }] },
];

const T14_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  ...partyBlockRU('Ответчик', 'defendant'),
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о взыскании денежных средств (обман)'),
  body('Знакомый/незнакомый мне ранее ответчик {{defendant_fio}} в {{debt_month}} {{debt_year}} года получил у меня в долг {{debt_goods}} на сумму {{debt_amount}} сум, однако обманул меня.'),
  body('При требовании вернуть полученное ответчик уклонялся, ссылаясь на «завтра-послезавтра».'),
  body('Я обратился в ОВД. Постановлением ОВД в возбуждении уголовного дела отказано в связи с отсутствием признаков преступления (ст. 83 ч. 2 УПК РУ).'),
  body('При этом в объяснении на имя начальника ОВД ответчик признал факт долга.'),
  body('{{iib_details}}'),
  body('Прошу взыскать с ответчика {{debt_amount}} сум долга и уплаченные судебные расходы.'),
  { text: '' },
  ...signatureBlockRU('Истец:'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'исковое заявление в 2 экз.;',
    'постановление ОВД и объяснения;',
    'квитанция гос. пошлины и почтовых расходов;',
    'копия паспорта.',
  ]),
  { text: [{ text: 'Примечание: гос. пошлина — 4% от суммы долга.', italics: true }] },
];

/* ============================================================
 * Template 15 — Иш ҳужжатларидан нусхалар (single-party applicant)
 * ============================================================ */
const T15_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('А Р И З А', 'Иш ҳужжатларидан нусхалар олиш ҳақида'),
  body('Менга фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{case_year}} йил {{case_month}} ойининг {{case_day}} куни даъвогар {{case_plaintiff_fio}}нинг жавобгар {{case_defendant_fio}}га нисбатан {{case_subject}} ҳақидаги {{case_number}}-сонли фуқаролик иши кўриб чиқилиб ҳал қилув қарори чиқарилган.'),
  body('Мен иш бўйича тараф бўлиб ҳисобланаман.'),
  body('{{copy_request}}'),
  body('Шу сабабли мазкур фуқаролик иши юзасидан чиқарилган ҳал қилув қарори (ёки иш ҳужжатлари ном кўрсатилган ҳолда) нусхаларини беришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Аризачи:'),
];

const T15_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('З А Я В Л Е Н И Е', 'о выдаче копий материалов дела'),
  body('В межрайонном гражданском суде {{court_name}} {{case_day}} {{case_month}} {{case_year}} года было рассмотрено гражданское дело № {{case_number}} по иску {{case_plaintiff_fio}} к {{case_defendant_fio}} о {{case_subject}}, по которому вынесено решение.'),
  body('Я являюсь стороной по делу.'),
  body('{{copy_request}}'),
  body('Прошу выдать копии судебного решения (или указанных материалов дела) по указанному делу.'),
  { text: '' },
  ...signatureBlockRU('Заявитель:'),
];

/* ============================================================
 * Template 16 — Янги очилган ҳолат бўйича бекор қилиш
 * ============================================================ */
const T16_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Аризачи (Даъвогар/Жавобгар)', 'plaintiff'),
  ...partyBlockCY('Даъвогар/Жавобгар', 'opposite_party', 'opposite_party_fio'),
  ...titleBlock('А Р И З А', 'Суд ҳужжати янги очилган ҳолат бўйича бекор қилиш ҳақида'),
  body('Даъвогар {{plaintiff_fio}} ва жавобгар {{opposite_party_fio}} ўртасида тузилган {{case_subject}} бўйича иш суд қарори билан ҳал қилинган.'),
  { text: [{ text: 'Суд қарорини янги очилган ҳолат бўйича бекор қилиш учун асос қилиб кўрсатаётган сабаблар ёзилиши керак', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{annul_reasons}}'),
  body('Шу сабабли суддан суд қарорини янги очилган ҳолат бўйича бекор қилиб, ишни мазмунан кўриб чиқишингизни сўрайман.'),
  { text: '' },
  ...attachmentBlock('Иловалар:', [
    'Ариза икки нусхада;',
    'Кечиктириш учун асос ҳужжатлар;',
    'Аризачи паспорт нусхаси;',
    'Почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
  ...signatureBlock('Аризачи:'),
];

const T16_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Заявитель (истец/ответчик)', 'plaintiff'),
  ...partyBlockRU('Истец/ответчик', 'opposite_party', 'opposite_party_fio'),
  ...titleBlock('З А Я В Л Е Н И Е', 'об отмене решения по вновь открывшимся обстоятельствам'),
  body('Между истцом {{plaintiff_fio}} и ответчиком {{opposite_party_fio}} рассматривалось дело по {{case_subject}}, по которому вынесено решение суда.'),
  { text: [{ text: 'Основания для отмены решения по вновь открывшимся обстоятельствам', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{annul_reasons}}'),
  body('Прошу суд отменить решение по вновь открывшимся обстоятельствам и рассмотреть дело по существу.'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'заявление в 2 экз.;',
    'документы, обосновывающие новые обстоятельства;',
    'копия паспорта заявителя;',
    'квитанция почтовых расходов.',
  ]),
  ...signatureBlockRU('Заявитель:'),
];

/* ============================================================
 * Template 17 — Суд ҳужжати ижросини кечиктириш
 * ============================================================ */
const T17_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Аризачи (Даъвогар/Жавобгар)', 'plaintiff'),
  ...partyBlockCY('Даъвогар/Жавобгар', 'opposite_party', 'opposite_party_fio'),
  ...titleBlock('А Р И З А', 'Суд ҳужжати ижросини кечиктириш ҳақида'),
  body('{{opposite_party_fio}} билан тузилган {{case_subject}} бўйича суд қарори чиқарилган.'),
  { text: [{ text: 'Суд қарорини кечиктириш учун асос қилиб кўрсатаётган сабаблар ёзилиши керак', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{postpone_reasons}}'),
  body('Шу сабабли суддан суд қарорининг ижросини {{postpone_period}} муддатга кечиктириб туришингизни сўрайман.'),
  { text: '' },
  ...attachmentBlock('Иловалар:', [
    'Ариза икки нусхада;',
    'Кечиктириш учун асос ҳужжатлар;',
    'Аризачи паспорт нусхаси;',
    'Почта харажати тўланганлиги тўғрисидаги патта.',
  ]),
  ...signatureBlock('Аризачи:'),
];

const T17_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Заявитель (истец/ответчик)', 'plaintiff'),
  ...partyBlockRU('Истец/ответчик', 'opposite_party', 'opposite_party_fio'),
  ...titleBlock('З А Я В Л Е Н И Е', 'об отсрочке исполнения судебного акта'),
  body('По делу с {{opposite_party_fio}} по {{case_subject}} вынесено решение суда.'),
  { text: [{ text: 'Основания для отсрочки исполнения', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{postpone_reasons}}'),
  body('Прошу суд предоставить отсрочку исполнения судебного акта сроком на {{postpone_period}}.'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'заявление в 2 экз.;',
    'документы, подтверждающие необходимость отсрочки;',
    'копия паспорта заявителя;',
    'квитанция почтовых расходов.',
  ]),
  ...signatureBlockRU('Заявитель:'),
];

/* ============================================================
 * Templates 18-20 — Appeal / Review / Cassation (regional panel)
 * Share the same shape; only the title and addressee differ.
 * ============================================================ */

const buildAppealCY = (
  instance: 'апелляция' | 'тафтиш' | 'кассация',
  title: string,
): BlockSpec[] => [
  ...appellateHeaderCY(instance),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock(title, 'ҳал қилув қарорига нисбатан'),
  body('Фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{ruling_year}} йил {{ruling_month}} ойининг {{ruling_day}} кунидаги ҳал қилув қароридан куйидагиларга кўра норозиман;'),
  { text: [{ text: 'Ҳал қилув қарорини бекор қилишга асос қилиб кўрсатаётган важлар ёзилиши керак', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{appeal_reasons}}'),
  body('Юқоридагиларга кўра ' + instance + ' инстанцияси судлов ҳайъатидан фуқаролик ишлари бўйича {{court_name}} туманлараро судининг {{ruling_year}} йил {{ruling_month}} ойининг {{ruling_day}} кунидаги ҳал қилув қарорини бекор қилиб, иш бўйича даъвони қаноатлантириш (рад қилиш) ҳақида янги қарор қабул қилишингизни сўрайман.'),
  { text: '' },
  ...attachmentBlock('Иловалар:', [
    title + ' нусхаси;',
    'Ҳал қилув қарори нусхаси;',
    'Давлат божи паттаси ва почта харажати паттаси;',
    'Бошқа ҳужжатлар.',
  ]),
  ...signatureBlock('Аризачи:'),
];

const buildAppealRU = (
  instance: 'апелляционная' | 'надзорная' | 'кассационная',
  title: string,
): BlockSpec[] => [
  ...appellateHeaderRU(instance),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock(title, 'на решение суда'),
  body('С решением межрайонного суда по гражданским делам {{court_name}} от {{ruling_day}} {{ruling_month}} {{ruling_year}} года не согласен(на) по следующим основаниям:'),
  { text: [{ text: 'Основания для отмены решения', italics: true, bold: true }], spaceAfter: TIGHT },
  body('{{appeal_reasons}}'),
  body('На основании изложенного прошу ' + instance + ' инстанцию отменить решение межрайонного суда по гражданским делам {{court_name}} от {{ruling_day}} {{ruling_month}} {{ruling_year}} года и принять новое решение об удовлетворении / отклонении иска.'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'копия жалобы;',
    'копия решения суда;',
    'квитанция гос. пошлины и почтовых расходов;',
    'иные документы.',
  ]),
  ...signatureBlockRU('Заявитель:'),
];

const T18_CY = buildAppealCY('апелляция', 'А П Е Л Л Я Ц И Я   Ш И К О Я Т И');
const T18_RU = buildAppealRU('апелляционная', 'А П Е Л Л Я Ц И О Н Н А Я   Ж А Л О Б А');
const T19_CY = buildAppealCY('тафтиш', 'Т А Ф Т И Ш   Ш И К О Я Т И');
const T19_RU = buildAppealRU('надзорная', 'Н А Д З О Р Н А Я   Ж А Л О Б А');
const T20_CY = buildAppealCY('кассация', 'К А С С А Ц И Я   Ш И К О Я Т И');
const T20_RU = buildAppealRU('кассационная', 'К А С С А Ц И О Н Н А Я   Ж А Л О Б А');

/* ============================================================
 * JINOYAT (criminal court) header helpers. Address line is composed
 * from `{{district_court_name}}` (short name like "Жиззах шаҳар суди")
 * + the wizard-collected `{{chairman_name}}`. Final line reads e.g.:
 *   "Жиноят ишлари бўйича Жиззах шаҳар судининг раиси С.Расуловга"
 * ============================================================ */

const jinHeaderCY = (): BlockSpec[] => [
  { text: [{ text: 'Жиноят ишлари бўйича {{district_court_name}}нинг', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'раиси {{chairman_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const jinHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'Председателю {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'по уголовным делам {{chairman_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

/** Tergov-sudya (investigative judge) header — for the МЖтК templates
 *  that address the criminal court's investigative judge by office, not
 *  by name. */
const jinTergovHeaderCY = (): BlockSpec[] => [
  { text: [{ text: 'Жиноят ишлари бўйича {{district_court_name}}нинг', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'тергов судьясига', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const jinTergovHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'Следственному судье {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'по уголовным делам', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

/** Regional appellate-panel header — for criminal-court appeals.
 *  Uses `{{court_name}}` (the region's short name, e.g. "Жиззах") so the
 *  rendered line reads "Жиззах вилоят судининг жиноят ишлари бўйича
 *  судлов ҳайъатига". */
const jinAppellateHeaderCY = (): BlockSpec[] => [
  { text: [{ text: '{{court_name}} вилоят судининг', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'жиноят ишлари бўйича судлов ҳайъатига', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const jinAppellateHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'В судебную коллегию по уголовным делам', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'областного суда {{court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

/** Signature block for jinoyat administrative-violation templates —
 *  signed as "Маъмурий ҳуқуқбузар" (offender) instead of "Аризачи". */
const signatureBlockOffenderCY = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Маъмурий ҳуқуқбузар:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
];

const signatureBlockOffenderRU = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Правонарушитель:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
];

/* ============================================================
 * Template — Жиноят: суд ҳукми нусхаси
 *   ariza-jinoyat-nuskha (T_JIN_NUSHA)
 * ============================================================ */
const T_JIN_NUSHA_CY: BlockSpec[] = [
  ...jinHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('А Р И З А', 'суд ҳукми ва иш ҳужжатлари нусхаси ҳақида'),
  body('Ушбу орқали Сиздан, жиноят ишлари бўйича {{district_court_name}}да {{case_day}}.{{case_month}}.{{case_year}} йилда кўрилган, {{defendant_fio}}га оид {{case_type_label}} бўйича суд ҳукмидан ҳамда бошқа иш ҳужжатларидан нусха беришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Фуқаро:'),
];

const T_JIN_NUSHA_RU: BlockSpec[] = [
  ...jinHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('З А Я В Л Е Н И Е', 'о выдаче копии приговора и материалов дела'),
  body('Настоящим прошу Вас выдать копию приговора и иных материалов дела по {{case_type_label}}, рассмотренному в {{district_court_name}} {{case_day}}.{{case_month}}.{{case_year}} в отношении {{defendant_fio}}.'),
  { text: '' },
  ...signatureBlockRU('Гражданин:'),
];

/* ============================================================
 * MAMURIY (administrative court) helpers.
 * Header reads "<district_court_name> раисига" — short, addresses the
 * court chairman by office. Party block is two stacked rows
 * (АРИЗАЧИ + ЖАВОБГАР), each with a small `(...)` italic caption
 * underneath like in the reference paper form. Signature is a single
 * row of three labeled cells: ФИО / имзо / сана.
 * ============================================================ */
const mamHeaderCY = (): BlockSpec[] => [
  { text: [{ text: '{{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'раисига', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const mamHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'Председателю {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const mamPartyBlockCY = (): BlockSpec[] => [
  {
    text: [
      { text: 'АРИЗАЧИ:', bold: true, tab: true },
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
  { text: [{ text: '(шикоят муаллифининг фамилияси, исми ва отасининг исми, жойлашган ери (почта манзили) ёки яшаш жойи)', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'ЖАВОБГАР:', bold: true, tab: true },
      { text: '{{defendant_org_name}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{defendant_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '(ташкилотнинг номи ва почта манзили)', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
];

const mamPartyBlockRU = (): BlockSpec[] => [
  {
    text: [
      { text: 'ЗАЯВИТЕЛЬ:', bold: true, tab: true },
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
  { text: [{ text: '(Ф.И.О. заявителя, почтовый адрес или место жительства)', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  {
    text: [
      { text: 'ОТВЕТЧИК:', bold: true, tab: true },
      { text: '{{defendant_org_name}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
    spaceAfter: TIGHT,
  },
  { text: [{ text: '{{defendant_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{defendant_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '(наименование и почтовый адрес организации)', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
];

const mamSignatureBlockCY = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: '{{plaintiff_fio}}', bold: true },
    { text: `${BLOCK_GAP}(имзо)${BLOCK_GAP}` },
    { text: '________________', italics: true },
  ] },
  { text: [
    { text: '(Аризачининг Ф.И.Ш)', italics: true },
    { text: `${BLOCK_GAP}(имзо)${BLOCK_GAP}` },
    { text: '(сана)', italics: true },
  ] },
];

const mamSignatureBlockRU = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [
    { text: '{{plaintiff_fio}}', bold: true },
    { text: `${BLOCK_GAP}(подпись)${BLOCK_GAP}` },
    { text: '________________', italics: true },
  ] },
  { text: [
    { text: '(Ф.И.О. заявителя)', italics: true },
    { text: `${BLOCK_GAP}(подпись)${BLOCK_GAP}` },
    { text: '(дата)', italics: true },
  ] },
];

/* ============================================================
 * Template — Маъмурий: мансабдор шахс ҳаракати қонунга хилоф
 *   ariza-mamuriy-mansabdor (T_MAM_MANSABDOR)
 * ============================================================ */
const T_MAM_MANSABDOR_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'А Р И З А   (Ш И К О Я Т)',
    'мансабдор шахсларнинг хатти-ҳаракатларини қонунга хилоф деб топиб, мажбуриятни юклаш ҳақида',
  ),
  body('Менга {{complaint_facts}}'),
  body('Шу сабабли Ўзбекистон Республикаси маъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддасига асосан жавобгар {{defendant_org_name}} мансабдор шахсларининг {{official_action}} ҳаракатини (ҳаракатсизлигини) қонунга хилоф деб топиб, {{duty_to_impose}} мажбуриятини юклашингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_MANSABDOR_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'З А Я В Л Е Н И Е   (Ж А Л О Б А)',
    'о признании действий должностных лиц незаконными и возложении обязанности',
  ),
  body('Мне {{complaint_facts}}'),
  body('На основании статьи 27 Кодекса об административном судопроизводстве Республики Узбекистан прошу признать действия (бездействие) должностных лиц ответчика {{defendant_org_name}} — {{official_action}} — незаконными и возложить на ответчика обязанность {{duty_to_impose}}.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: қарорни ҳақиқий эмас деб топиш
 *   ariza-mamuriy-qaror-bekor (T_MAM_QAROR_BEKOR)
 * ============================================================ */
const T_MAM_QAROR_BEKOR_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'А Р И З А   (Ш И К О Я Т)',
    'қарорни ҳақиқий эмас деб топиш ҳақида',
  ),
  body('Менга {{complaint_facts}}'),
  body('Шу сабабли Ўзбекистон Республикаси маъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддасига асосан жавобгар {{defendant_org_name}}нинг {{decision_year}}-йил {{decision_month}}-ойдаги {{decision_number}}-сонли қарорини ҳақиқий эмас деб топишингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_QAROR_BEKOR_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'З А Я В Л Е Н И Е   (Ж А Л О Б А)',
    'о признании решения недействительным',
  ),
  body('Мне {{complaint_facts}}'),
  body('На основании статьи 27 Кодекса об административном судопроизводстве Республики Узбекистан прошу признать решение ответчика {{defendant_org_name}} № {{decision_number}} от {{decision_day}}.{{decision_month}}.{{decision_year}} недействительным.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Фуқаролик: маънавий зарар ундириш ҳақида даъво ариза
 *   davo-ariza-manaviy-zarar (T_DAVO_MANAVIY_ZARAR)
 * The defendant here is a state organ (ИИБ ЙХХБ, etc.) with no full
 * postal address, so the defendant block is a single line — just the
 * organization's short name — matching the user's reference paper form.
 * ============================================================ */
const T_DAVO_MANAVIY_ZARAR_CY: BlockSpec[] = [
  ...stdHeaderCY(),
  ...partyBlockCY('Даъвогар', 'plaintiff'),
  {
    text: [
      { text: 'Жавобгар:', bold: true, tab: true },
      { text: '{{defendant_org_name}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
  },
  { text: '' },
  ...titleBlock('Д А Ъ В О   А Р И З А', 'маънавий зарар ундириш ҳақида'),
  body('{{case_facts}}'),
  body('{{moral_damage_description}}'),
  { text: '' },
  { text: [{ text: 'Сўрайман:', bold: true }] },
  body('{{defendant_org_name}}дан менинг фойдамга {{damage_amount}} сўм маънавий зарар ундириб беришингизни сўрайман.'),
  ...signatureBlock('Даъвогар:'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
];

const T_DAVO_MANAVIY_ZARAR_RU: BlockSpec[] = [
  ...stdHeaderRU(),
  ...partyBlockRU('Истец', 'plaintiff'),
  {
    text: [
      { text: 'Ответчик:', bold: true, tab: true },
      { text: '{{defendant_org_name}}', tab: true, italics: true, bold: true },
    ],
    rightTabStop: PARTY_LABEL_RIGHT,
    tabStop: PARTY_INDENT,
    leftIndent: PARTY_INDENT,
    hanging: PARTY_INDENT,
  },
  { text: '' },
  ...titleBlock('И С К О В О Е   З А Я В Л Е Н И Е', 'о взыскании морального вреда'),
  body('{{case_facts}}'),
  body('{{moral_damage_description}}'),
  { text: '' },
  { text: [{ text: 'Прошу:', bold: true }] },
  body('Взыскать с {{defendant_org_name}} в мою пользу {{damage_amount}} сум в счёт компенсации морального вреда.'),
  ...signatureBlockRU('Истец:'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
];

/* ============================================================
 * IQTISODIY (economic court) helpers.
 * Three header flavors:
 *   - iqtSudHeader      → district court (first-instance filings)
 *   - iqtAppellateHeader→ regional court, appellate panel
 *   - iqtCassationHeader→ regional court, cassation panel
 *
 * Party block flavor depends on the template — corporate w/ bank
 * details for kassatsiya, simpler name+address for the rest.
 *
 * Signature is signed by "Раҳбари: <FIO>" since the applicant in
 * economic-court matters is typically a legal entity.
 * ============================================================ */

const iqtSudHeaderCY = (): BlockSpec[] => [
  { text: [{ text: '{{district_court_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const iqtSudHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'В {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const iqtAppellateHeaderCY = (): BlockSpec[] => [
  { text: [{ text: '{{district_court_name}} иқтисодий ишлар бўйича', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'апелляция инстанциясига', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const iqtAppellateHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'В апелляционную инстанцию по экономическим', bold: true, italics: true }], leftIndent: HEADER_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'делам {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const iqtCassationHeaderCY = (): BlockSpec[] => [
  { text: [{ text: '{{district_court_name}}га', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

const iqtCassationHeaderRU = (): BlockSpec[] => [
  { text: [{ text: 'В {{district_court_name}}', bold: true, italics: true }], leftIndent: HEADER_INDENT },
  { text: '' },
];

/** Simple two-row party block: <label>: <name> + address. Used by
 *  sud-buyrug, ijro-tikla, apellyatsiya (no bank rekvizit shown). */
function iqtPartyBlockCY(
  label1: string,
  side1: 'plaintiff' | 'defendant',
  label2: string,
  side2: 'plaintiff' | 'defendant',
): BlockSpec[] {
  const row = (label: string, side: 'plaintiff' | 'defendant'): BlockSpec[] => [
    {
      text: [
        { text: `${label}:`, bold: true, tab: true },
        { text: `{{${side}_name}}`, tab: true, italics: true, bold: true },
      ],
      rightTabStop: PARTY_LABEL_RIGHT,
      tabStop: PARTY_INDENT,
      leftIndent: PARTY_INDENT,
      hanging: PARTY_INDENT,
      spaceAfter: TIGHT,
    },
    { text: [{ text: `{{${side}_address_line1}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
    { text: [{ text: `{{${side}_address_line2}}`, italics: true }], leftIndent: PARTY_INDENT },
    { text: '' },
  ];
  return [...row(label1, side1), ...row(label2, side2)];
}

function iqtPartyBlockRU(
  label1: string,
  side1: 'plaintiff' | 'defendant',
  label2: string,
  side2: 'plaintiff' | 'defendant',
): BlockSpec[] {
  return iqtPartyBlockCY(label1, side1, label2, side2);
}

/** Corporate party block with bank reqs (МЧЖ name, address, x/р, МФО,
 *  СТИР). Used by kassatsiya. */
function iqtCorpPartyBlockCY(): BlockSpec[] {
  const corpRow = (label: string, side: 'plaintiff' | 'defendant'): BlockSpec[] => [
    {
      text: [
        { text: `${label}:`, bold: true, tab: true },
        { text: `{{${side}_name}}`, tab: true, italics: true, bold: true },
      ],
      rightTabStop: PARTY_LABEL_RIGHT,
      tabStop: PARTY_INDENT,
      leftIndent: PARTY_INDENT,
      hanging: PARTY_INDENT,
      spaceAfter: TIGHT,
    },
    { text: [{ text: `Манзил: {{${side}_address_line1}}, {{${side}_address_line2}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
    { text: [{ text: `х/р: {{${side}_bank_account}}    МФО: {{${side}_mfo}}    СТИР: {{${side}_stir}}`, italics: true }], leftIndent: PARTY_INDENT },
    { text: '' },
  ];
  return [...corpRow('Даъвогар', 'plaintiff'), ...corpRow('Жавобгар', 'defendant')];
}

function iqtCorpPartyBlockRU(): BlockSpec[] {
  const corpRow = (label: string, side: 'plaintiff' | 'defendant'): BlockSpec[] => [
    {
      text: [
        { text: `${label}:`, bold: true, tab: true },
        { text: `{{${side}_name}}`, tab: true, italics: true, bold: true },
      ],
      rightTabStop: PARTY_LABEL_RIGHT,
      tabStop: PARTY_INDENT,
      leftIndent: PARTY_INDENT,
      hanging: PARTY_INDENT,
      spaceAfter: TIGHT,
    },
    { text: [{ text: `Адрес: {{${side}_address_line1}}, {{${side}_address_line2}}`, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
    { text: [{ text: `р/с: {{${side}_bank_account}}    МФО: {{${side}_mfo}}    СТИР: {{${side}_stir}}`, italics: true }], leftIndent: PARTY_INDENT },
    { text: '' },
  ];
  return [...corpRow('Истец', 'plaintiff'), ...corpRow('Ответчик', 'defendant')];
}

const iqtSignatureBlockCY = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [{ text: '"{{plaintiff_name}}"', bold: true }] },
  { text: [{ text: 'Раҳбари:', bold: true }, { text: `${BLOCK_GAP}{{director_fio}}`, bold: true }] },
];

const iqtSignatureBlockRU = (): BlockSpec[] => [
  { text: '' },
  { text: '' },
  { text: [{ text: '«{{plaintiff_name}}»', bold: true }] },
  { text: [{ text: 'Руководитель:', bold: true }, { text: `${BLOCK_GAP}{{director_fio}}`, bold: true }] },
];

/* ============================================================
 * Template — Иктисодий: суд буйруғи бериш (ИПК 135-138)
 *   ariza-iqtisodiy-sud-buyrug (T_IQT_SUD_BUYRUG)
 * ============================================================ */
const T_IQT_SUD_BUYRUG_CY: BlockSpec[] = [
  ...iqtSudHeaderCY(),
  ...iqtPartyBlockCY('Кредитор', 'plaintiff', 'Қарздор', 'defendant'),
  ...titleBlock(
    'А Р И З А',
    'қарзни ундириш ҳақида суд буйруғи бериш тўғрисида',
  ),
  body('Кредиторнинг қонун ҳужжатларига асосланган талаби: {{legal_basis}}.'),
  body('Талабга асос бўлган ҳолатлар: {{factual_basis}}'),
  body('Талабнинг асосларини тасдиқловчи далиллар: {{evidence}}'),
  body('Ундириладиган сумманинг ҳисоб-китоби: {{calculation}}'),
  body('Ундирилаётган қарздорлик вужудга келган давр: {{debt_period}}.'),
  body('Юқоридагиларни инобатга олиб, суддан Ўзбекистон Республикаси Иқтисодий процессуал кодексининг 135-138-моддаларига асосан {{defendant_name}}дан менинг фойдамга {{requested_amount}} сўм миқдорида қарзни ундириб бериш тўғрисида суд буйруғи чиқариб беришингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockCY(),
];

const T_IQT_SUD_BUYRUG_RU: BlockSpec[] = [
  ...iqtSudHeaderRU(),
  ...iqtPartyBlockRU('Кредитор', 'plaintiff', 'Должник', 'defendant'),
  ...titleBlock(
    'З А Я В Л Е Н И Е',
    'о выдаче судебного приказа о взыскании задолженности',
  ),
  body('Правовое основание требования кредитора: {{legal_basis}}.'),
  body('Обстоятельства, лежащие в основе требования: {{factual_basis}}'),
  body('Доказательства, подтверждающие основания требования: {{evidence}}'),
  body('Расчёт взыскиваемой суммы: {{calculation}}'),
  body('Период образования задолженности: {{debt_period}}.'),
  body('На основании изложенного и руководствуясь ст. 135-138 Экономического процессуального кодекса Республики Узбекистан, прошу выдать судебный приказ о взыскании с {{defendant_name}} в пользу заявителя задолженности в размере {{requested_amount}} сум.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockRU(),
];

/* ============================================================
 * Template — Иктисодий: ижро варақаси тиклаш + дубликат (ИПК 340-341)
 *   ariza-iqtisodiy-ijro-tiklash (T_IQT_IJRO_TIKLA)
 * ============================================================ */
const T_IQT_IJRO_TIKLA_CY: BlockSpec[] = [
  ...iqtSudHeaderCY(),
  ...iqtPartyBlockCY('Даъвогар', 'plaintiff', 'Жавобгар', 'defendant'),
  ...titleBlock(
    'А Р И З А',
    'ижро варақасини ижрога тақдим этишнинг ўтказиб юборилган муддатини тиклаш ва дубликатини бериш ҳақида',
  ),
  body('{{issuing_court_name}} томонидан {{case_number}}-сонли иш бўйича {{writ_day}}.{{writ_month}}.{{writ_year}} йилда ижро варақаси чиқарилган.'),
  body('Мазкур ижро варақасини ижрога тақдим этиш муддати қуйидаги узрли сабабларга кўра ўтказиб юборилди: {{missing_reason}}'),
  body('Юқоридагиларни инобатга олиб, суддан Ўзбекистон Республикаси Иқтисодий процессуал кодексининг 340-341-моддаларига асосан {{case_number}}-сонли иш бўйича {{issuing_court_name}} томонидан чиқарилган ижро варақасини ижрога тақдим этишнинг ўтказиб юборилган муддатини тиклашингизни ва унинг дубликатини беришингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockCY(),
];

const T_IQT_IJRO_TIKLA_RU: BlockSpec[] = [
  ...iqtSudHeaderRU(),
  ...iqtPartyBlockRU('Взыскатель', 'plaintiff', 'Должник', 'defendant'),
  ...titleBlock(
    'З А Я В Л Е Н И Е',
    'о восстановлении пропущенного срока предъявления исполнительного листа и выдаче дубликата',
  ),
  body('{{issuing_court_name}} {{writ_day}}.{{writ_month}}.{{writ_year}} по делу № {{case_number}} был выдан исполнительный лист.'),
  body('Срок предъявления указанного исполнительного листа к исполнению был пропущен по следующим уважительным причинам: {{missing_reason}}'),
  body('На основании изложенного и руководствуясь ст. 340-341 Экономического процессуального кодекса Республики Узбекистан, прошу восстановить пропущенный срок предъявления к исполнению исполнительного листа, выданного {{issuing_court_name}} по делу № {{case_number}}, и выдать его дубликат.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockRU(),
];

/* ============================================================
 * Template — Иктисодий: апелляция шикояти (ИПК 259-265)
 *   shikoyat-iqtisodiy-apellyatsiya (T_IQT_APELL)
 * ============================================================ */
const T_IQT_APELL_CY: BlockSpec[] = [
  ...iqtAppellateHeaderCY(),
  ...iqtPartyBlockCY('Шикоят берувчи', 'plaintiff', 'Жавобгар', 'defendant'),
  body('Устидан шикоят берилаётган ҳал қилув қарорини қабул қилган иқтисодий суд: {{lower_court_name}}. Иш рақами: {{case_number}}. Ҳал қилув қарори санаси: {{ruling_day}}.{{ruling_month}}.{{ruling_year}}. Низо предмети: {{dispute_subject}}.'),
  ...titleBlock('А П Е Л Л Я Ц И Я   Ш И К О Я Т И', 'ҳал қилув қарорига нисбатан'),
  body('Шикоят берувчи иш ҳолатлари ва далилларга, қонунлар ва бошқа норматив-ҳуқуқий ҳужжатларга ҳавола қилган ҳолда ҳал қилув қарорини нотўғри деб ҳисоблаш учун келтирган асослари: {{appeal_grounds}}'),
  body('Юқоридагиларни инобатга олиб, суддан Ўзбекистон Республикаси Иқтисодий процессуал кодексининг 259-265-моддаларига асосан қуйидагиларни СЎРАЙМАН: {{appeal_requests}}'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockCY(),
];

const T_IQT_APELL_RU: BlockSpec[] = [
  ...iqtAppellateHeaderRU(),
  ...iqtPartyBlockRU('Податель жалобы', 'plaintiff', 'Ответчик', 'defendant'),
  body('Суд, вынесший обжалуемое решение: {{lower_court_name}}. Номер дела: {{case_number}}. Дата решения: {{ruling_day}}.{{ruling_month}}.{{ruling_year}}. Предмет спора: {{dispute_subject}}.'),
  ...titleBlock('А П Е Л Л Я Ц И О Н Н А Я   Ж А Л О Б А', 'на решение суда'),
  body('Основания подателя жалобы для признания решения суда неправильным со ссылками на обстоятельства, доказательства, нормы права: {{appeal_grounds}}'),
  body('На основании изложенного и руководствуясь ст. 259-265 Экономического процессуального кодекса Республики Узбекистан, ПРОШУ: {{appeal_requests}}'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...iqtSignatureBlockRU(),
];

/* ============================================================
 * Template — Иктисодий: кассация шикояти
 *   shikoyat-iqtisodiy-kassatsiya (T_IQT_KASS)
 * ============================================================ */
const T_IQT_KASS_CY: BlockSpec[] = [
  ...iqtCassationHeaderCY(),
  ...iqtCorpPartyBlockCY(),
  ...titleBlock(
    'К А С С А Ц И Я   Ш И К О Я Т И',
    '{{lower_court_name}}нинг {{ruling_day}}.{{ruling_month}}.{{ruling_year}} йилдаги {{case_number}}-сонли ҳал қилув қарори устидан',
  ),
  body('"{{plaintiff_name}}" томонидан жавобгар "{{defendant_name}}" ўртасида {{lower_court_name}} томонидан {{ruling_day}}.{{ruling_month}}.{{ruling_year}} йилда суд бўлиб ўтди. Иш мазмуни: {{case_brief}}'),
  body('Мазкур ҳал қилув қарорини қуйидагиларга кўра асоссиз деб ҳисоблаймиз: {{disagreement_grounds}}'),
  body('Юқоридагиларни инобатга олиб, СЎРАЙМИЗ:'),
  body('1. Кассация шикоятини иш юритувингизга қабул қилишингизни ҳамда суд куни ва жойи ҳақида маълум қилишингизни.'),
  body('2. {{lower_court_name}} томонидан {{ruling_day}}.{{ruling_month}}.{{ruling_year}} йилда чиқарилган {{case_number}}-сонли ҳал қилув қарорини бекор қилишингизни.'),
  body('3. Олдиндан {{duty_amount}} сўм давлат божи ва {{postage_amount}} сўм почта харажатларини ундириб беришингизни.'),
  { text: '' },
  { text: [{ text: 'Илова:', bold: true }] },
  { text: [{ text: '- Аризанинг жавобгарга жўнатилганлиги тўғрисида почта квитансияси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Почта харажати тўланганлиги тўғрисидаги банк маълумотномаси;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Давлат божи тўланганлиги тўғрисидаги банк маълумотномаси.', italics: true }] },
  ...iqtSignatureBlockCY(),
];

const T_IQT_KASS_RU: BlockSpec[] = [
  ...iqtCassationHeaderRU(),
  ...iqtCorpPartyBlockRU(),
  ...titleBlock(
    'К А С С А Ц И О Н Н А Я   Ж А Л О Б А',
    'на решение {{lower_court_name}} от {{ruling_day}}.{{ruling_month}}.{{ruling_year}} по делу № {{case_number}}',
  ),
  body('Между истцом «{{plaintiff_name}}» и ответчиком «{{defendant_name}}» {{lower_court_name}} {{ruling_day}}.{{ruling_month}}.{{ruling_year}} было рассмотрено дело. Краткое содержание: {{case_brief}}'),
  body('Считаем данное решение необоснованным по следующим основаниям: {{disagreement_grounds}}'),
  body('На основании изложенного, ПРОСИМ:'),
  body('1. Принять кассационную жалобу к производству и сообщить о дне и месте судебного заседания.'),
  body('2. Отменить решение {{lower_court_name}} от {{ruling_day}}.{{ruling_month}}.{{ruling_year}} по делу № {{case_number}}.'),
  body('3. Взыскать государственную пошлину в размере {{duty_amount}} сум и почтовые расходы в размере {{postage_amount}} сум.'),
  { text: '' },
  { text: [{ text: 'Приложение:', bold: true }] },
  { text: [{ text: '- Почтовая квитанция о направлении заявления ответчику;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Банковская справка об оплате почтовых расходов;', italics: true }], spaceAfter: TIGHT },
  { text: [{ text: '- Банковская справка об оплате госпошлины.', italics: true }] },
  ...iqtSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: давлат божидан озод қилиш (Art 10)
 *   iltimosnoma-mamuriy-goshlina (T_MAM_GOSHLINA)
 * ============================================================ */
const T_MAM_GOSHLINA_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'И Л Т И М О С Н О М А',
    'давлат божини тўлашдан озод қилиш ҳақида',
  ),
  body('Ҳозирда {{district_court_name}}да менинг {{defendant_org_name}}га нисбатан {{main_claim_subject}} тўғрисидаги аризам кўрилмоқда. Даъво қиймати — {{claim_amount}} сўм, мазкур иш бўйича белгиланган давлат божи миқдори — {{duty_amount}} сўм.'),
  body('Ўзбекистон Республикасининг "Давлат божи тўғрисида"ги қонунининг 10-моддасига кўра, мен қуйидаги асос билан давлат божини тўлашдан озод қилинаман: {{exemption_grounds}}.'),
  body('Шу сабабли Сиздан мазкур иш бўйича давлат божини тўлашдан мени озод қилишингизни сўрайман.'),
  { text: '' },
  ...mamSignatureBlockCY(),
];

const T_MAM_GOSHLINA_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'Х О Д А Т А Й С Т В О',
    'об освобождении от уплаты государственной пошлины',
  ),
  body('В производстве {{district_court_name}} находится мое заявление к {{defendant_org_name}} по предмету: {{main_claim_subject}}. Цена иска — {{claim_amount}} сум, размер государственной пошлины — {{duty_amount}} сум.'),
  body('Согласно ст. 10 Закона Республики Узбекистан «О государственной пошлине», я освобождён(а) от уплаты государственной пошлины по следующему основанию: {{exemption_grounds}}.'),
  body('На основании изложенного прошу освободить меня от уплаты государственной пошлины по указанному делу.'),
  { text: '' },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: давлат органи зарарини ундириш
 *   ariza-mamuriy-zarar (T_MAM_ZARAR)
 * ============================================================ */
const T_MAM_ZARAR_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'А Р И З А',
    'давлат органи ҳаракатлари оқибатида етказилган зарарни ундириш ҳақида',
  ),
  body('Менга {{illegal_action}}'),
  body('Мазкур ноқонуний ҳаракатлар натижасида менга жами {{harm_amount}} сўм миқдорида зарар етказилди.'),
  body('Ҳолатлар ва қонуний асос: {{complaint_facts}}'),
  body('Шу сабабли Ўзбекистон Республикаси Фуқаролик кодексининг 990-моддаси ва маъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддасига асосан жавобгар {{defendant_org_name}}дан менинг фойдамга {{harm_amount}} сўм миқдорида зарарни ундиришингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_ZARAR_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'З А Я В Л Е Н И Е',
    'о взыскании вреда, причинённого действиями госоргана',
  ),
  body('Мне {{illegal_action}}'),
  body('В результате указанных незаконных действий мне причинён вред на общую сумму {{harm_amount}} сум.'),
  body('Обстоятельства и правовое обоснование: {{complaint_facts}}'),
  body('На основании ст. 990 Гражданского кодекса Республики Узбекистан и ст. 27 Кодекса об административном судопроизводстве прошу взыскать с ответчика {{defendant_org_name}} в мою пользу сумму ущерба в размере {{harm_amount}} сум.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: норматив ҳужжатни бекор қилиш
 *   ariza-mamuriy-npa-bekor (T_MAM_NPA)
 * ============================================================ */
const T_MAM_NPA_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'А Р И З А',
    'норматив-ҳуқуқий ҳужжатни ҳақиқий эмас деб топиш ҳақида',
  ),
  body('{{defendant_org_name}} томонидан {{npa_year}}-йил {{npa_month}}-ойнинг {{npa_day}}-кунида {{npa_number}}-сонли {{npa_name}} қабул қилинган. Мазкур ҳужжатнинг {{npa_disputed_part}} қисми менинг қонуний ҳуқуқ ва манфаатларимни бузмоқда.'),
  body('Ҳолатлар, далиллар ва қонуний асос: {{complaint_facts}}'),
  body('Шу сабабли Ўзбекистон Республикаси маъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддасига асосан жавобгар {{defendant_org_name}}нинг {{npa_name}} ҳужжатини ({{npa_disputed_part}} қисмида) ҳақиқий эмас деб топишингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_NPA_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'З А Я В Л Е Н И Е',
    'о признании нормативно-правового акта недействительным',
  ),
  body('{{defendant_org_name}} {{npa_day}}.{{npa_month}}.{{npa_year}} был принят {{npa_name}} № {{npa_number}}. Указанный акт ({{npa_disputed_part}}) нарушает мои законные права и интересы.'),
  body('Обстоятельства, доказательства и правовое обоснование: {{complaint_facts}}'),
  body('На основании ст. 27 Кодекса об административном судопроизводстве Республики Узбекистан прошу признать {{npa_name}} ответчика {{defendant_org_name}} (в части {{npa_disputed_part}}) недействительным.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: ҳужжат ижросини тўхтатиш (interim measure)
 *   iltimosnoma-mamuriy-toxtatish (T_MAM_TOXTAT)
 * ============================================================ */
const T_MAM_TOXTAT_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'И Л Т И М О С Н О М А',
    'оспариласи ҳужжат ижросини тўхтатиб туриш ҳақида',
  ),
  body('Ҳозирда {{district_court_name}}да менинг {{defendant_org_name}}га нисбатан {{case_number}}-сонли иш кўрилмоқда.'),
  body('Мазкур иш доирасида оспарилган {{acted_act}}нинг дарҳол ижроси менга жиддий ва қайтариб бўлмас зарар келтириши мумкин: {{suspension_grounds}}'),
  body('Шу сабабли Ўзбекистон Республикаси маъмурий суд ишларини юритиш тўғрисидаги кодексининг таъминлаш чоралари тўғрисидаги моддаларига асосан, Сиздан {{acted_act}} ижросини иш моҳиятан кўриб чиқилгунча тўхтатиб туришингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_TOXTAT_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'Х О Д А Т А Й С Т В О',
    'о приостановлении исполнения оспариваемого акта',
  ),
  body('В производстве {{district_court_name}} находится дело № {{case_number}} по моему заявлению к {{defendant_org_name}}.'),
  body('Немедленное исполнение оспариваемого в рамках данного дела {{acted_act}} может причинить мне существенный и невосполнимый ущерб: {{suspension_grounds}}'),
  body('На основании положений Кодекса об административном судопроизводстве Республики Узбекистан об обеспечительных мерах прошу приостановить исполнение {{acted_act}} до рассмотрения дела по существу.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Маъмурий: БИБ ижрочисига шикоят
 *   shikoyat-mamuriy-pristav (T_MAM_PRISTAV)
 * ============================================================ */
const T_MAM_PRISTAV_CY: BlockSpec[] = [
  ...mamHeaderCY(),
  ...mamPartyBlockCY(),
  ...titleBlock(
    'Ш И К О Я Т',
    'Мажбурий ижро бюроси ижрочисининг ҳаракатига нисбатан',
  ),
  body('{{defendant_org_name}} ижрочиси {{pristav_fio}} томонидан {{execution_case_number}}-сонли ижро иши бўйича қуйидаги ноқонуний ҳаракат содир этилган: {{illegal_action}}'),
  body('Мазкур ҳаракат менинг қонуний ҳуқуқ ва манфаатларимни бузади.'),
  body('Шу сабабли Ўзбекистон Республикаси маъмурий суд ишларини юритиш тўғрисидаги кодексининг 27-моддасига асосан жавобгар {{defendant_org_name}} ижрочиси {{pristav_fio}}нинг ҳаракатларини қонунга хилоф деб топиб, {{requested_action}}ингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockCY(),
];

const T_MAM_PRISTAV_RU: BlockSpec[] = [
  ...mamHeaderRU(),
  ...mamPartyBlockRU(),
  ...titleBlock(
    'Ж А Л О Б А',
    'на действия пристава-исполнителя Бюро принудительного исполнения',
  ),
  body('Приставом-исполнителем {{defendant_org_name}} {{pristav_fio}} по исполнительному производству № {{execution_case_number}} совершено следующее незаконное действие: {{illegal_action}}'),
  body('Указанное действие нарушает мои законные права и интересы.'),
  body('На основании ст. 27 Кодекса об административном судопроизводстве Республики Узбекистан прошу признать действия пристава-исполнителя {{pristav_fio}} ({{defendant_org_name}}) незаконными и {{requested_action}}.'),
  { text: '' },
  { text: [{ text: 'Приложение: ', bold: true }, { text: '{{attachments_list}}' }] },
  ...mamSignatureBlockRU(),
];

/* ============================================================
 * Template — Жиноят: МЖтК 315 (objection to admin penalty)
 *   ariza-jinoyat-315 (T_JIN_315)
 * ============================================================ */
const T_JIN_315_CY: BlockSpec[] = [
  ...jinTergovHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('А Р И З А', 'Ўзбекистон Республикаси МЖтКнинг 315-моддаси тартибида'),
  body('Ушбу орқали Сизга, {{penalty_org}} томонидан менга нисбатан {{order_day}}.{{order_month}}.{{order_year}} йилда МЖтКнинг {{mjtk_article}}-моддасида кўрсатилган маъмурий ҳуқуқбузарликни содир этганлигим ҳолати юзасидан маъмурий жарима қўллаш тўғрисида қарор қабул қилинган.'),
  body('Бироқ, мен ушбу маъмурий жарима қўллаш тўғрисидаги қарордан қуйидаги сабабларга кўра норозиман:'),
  body('{{disagreement_reasons}}'),
  body('Шу сабабли мазкур {{penalty_org}} томонидан қабул қилинган {{order_number}}-сонли маъмурий жарима қўллаш тўғрисидаги қарорни {{action_type_label}}ингизни сўрайман.'),
  { text: '' },
  { text: [{ text: 'Илова: "', bold: true }, { text: '{{attached_docs_count}}' }, { text: '" ҳужжатлар варақда.' }] },
  ...signatureBlock('Фуқаро:'),
];

const T_JIN_315_RU: BlockSpec[] = [
  ...jinTergovHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('З А Я В Л Е Н И Е', 'в порядке статьи 315 МЖтК Республики Узбекистан'),
  body('Настоящим сообщаю, что {{penalty_org}} в отношении меня {{order_day}}.{{order_month}}.{{order_year}} вынес постановление о наложении административного штрафа по статье {{mjtk_article}} МЖтК.'),
  body('С данным постановлением я не согласен(а) по следующим причинам:'),
  body('{{disagreement_reasons}}'),
  body('На основании изложенного прошу постановление № {{order_number}}, вынесенное {{penalty_org}}, {{action_type_label}}.'),
  { text: '' },
  { text: [{ text: 'Приложение: "', bold: true }, { text: '{{attached_docs_count}}' }, { text: '" документов на листах.' }] },
  ...signatureBlockRU('Гражданин:'),
];

/* ============================================================
 * Template — Жиноят: МЖтК 316 (restore 10-day complaint deadline)
 *   iltimosnoma-jinoyat-316 (T_JIN_316)
 * ============================================================ */
const T_JIN_316_CY: BlockSpec[] = [
  ...jinTergovHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('И Л Т И М О С Н О М А', 'Ўзбекистон Республикаси МЖтКнинг 316-моддаси тартибида'),
  body('Ушбу орқали Сизга, {{penalty_org}} томонидан менга нисбатан {{order_day}}.{{order_month}}.{{order_year}} йилда МЖтКнинг {{mjtk_article}}-моддасида кўрсатилган маъмурий ҳуқуқбузарликни содир этганлигим ҳолати юзасидан маъмурий жарима қўллаш тўғрисида қарор қабул қилинган.'),
  body('Мен маъмурий жарима қўллашга оид қарор қабул қилинганлигини {{learned_day}}.{{learned_month}}.{{learned_year}} йилда {{learned_how}} орқали билдим.'),
  body('Шу сабабли Ўзбекистон Республикаси МЖтКнинг 316-моддасида кўрсатилган 10 кунлик шикоят бериш муддатини қуйидаги узрли сабабларга кўра ўтказиб юбордим:'),
  body('{{missing_reason}}'),
  body('Шу сабабли Сиздан узрли сабабларга кўра ўтказиб юборилган шикоят бериш муддатини тиклаб, менинг аризамни кўриб чиқишингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Фуқаро:'),
];

const T_JIN_316_RU: BlockSpec[] = [
  ...jinTergovHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('Х О Д А Т А Й С Т В О', 'в порядке статьи 316 МЖтК Республики Узбекистан'),
  body('Настоящим сообщаю, что {{penalty_org}} в отношении меня {{order_day}}.{{order_month}}.{{order_year}} вынес постановление о наложении административного штрафа по статье {{mjtk_article}} МЖтК.'),
  body('О вынесении данного постановления я узнал(а) {{learned_day}}.{{learned_month}}.{{learned_year}} через {{learned_how}}.'),
  body('Установленный статьёй 316 МЖтК 10-дневный срок обжалования был пропущен по следующим уважительным причинам:'),
  body('{{missing_reason}}'),
  body('На основании изложенного прошу восстановить пропущенный по уважительной причине срок обжалования и рассмотреть моё заявление по существу.'),
  { text: '' },
  ...signatureBlockRU('Гражданин:'),
];

/* ============================================================
 * Template — Жиноят: иш ҳужжатлари билан танишув
 *   ariza-jinoyat-tanishuv (T_JIN_TANISH)
 * ============================================================ */
const T_JIN_TANISH_CY: BlockSpec[] = [
  ...jinHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('А Р И З А', 'иш ҳужжатлари билан танишиш ҳақида'),
  body('Ушбу орқали Сиздан, {{tanish_subject_phrase}} жиноят ишлари бўйича {{district_court_name}}да {{case_day}}.{{case_month}}.{{case_year}} йилда {{case_status_label}} иш ({{case_type_label}}га оид) юзасидан иш ҳужжатлари билан танишиб чиқишимга рухсат беришингизни сўрайман.'),
  { text: '' },
  ...signatureBlock('Фуқаро:'),
];

const T_JIN_TANISH_RU: BlockSpec[] = [
  ...jinHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('З А Я В Л Е Н И Е', 'об ознакомлении с материалами дела'),
  body('Настоящим прошу разрешить мне ознакомиться с материалами дела {{tanish_subject_phrase}}, {{case_status_label}} в {{district_court_name}} {{case_day}}.{{case_month}}.{{case_year}} ({{case_type_label}}).'),
  { text: '' },
  ...signatureBlockRU('Гражданин:'),
];

/* ============================================================
 * Template — Жиноят: апелляция/кассация шикояти (admin penalty)
 *   shikoyat-jinoyat-apellyatsiya (T_JIN_APPEAL)
 * ============================================================ */
const T_JIN_APPEAL_CY: BlockSpec[] = [
  ...jinAppellateHeaderCY(),
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'да яшовчи {{lower_court_name}}нинг {{order_day}}.{{order_month}}.{{order_year}} кунги қарори билан маъмурий жавобгарликка тортилган ҳуқуқбузар', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_fio}}', italics: true, bold: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'томонидан', italics: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  ...titleBlock('{{instance_type_title}}', 'маъмурий жазо қарорига нисбатан'),
  body('{{lower_court_name}}нинг {{order_day}}.{{order_month}}.{{order_year}} кунги қарори билан мен Ўзбекистон Республикаси МЖтКнинг {{mjtk_article}}-моддаси билан айбли деб топилиб, менга нисбатан маъмурий жазо қўлланди.'),
  body('Мен мазкур {{lower_court_name}}нинг қароридан қуйидаги сабабларга кўра норозиман ва суд қарори адолатсиз қабул қилинди деб ўйлайман:'),
  body('{{disagreement_reasons}}'),
  body('Иш бўйича бошқа далиллар, гувоҳлар ва бошқа асослар:'),
  body('{{additional_evidence}}'),
  body('Шу сабабли Сиздан мазкур менга нисбатан кўрилган маъмурий ҳуқуқбузарликка оид иш материалини қайта {{instance_type_label}} инстанцияда кўриб чиқиб, мен келтирган важларни ўрганиб, иш бўйича адолатли қарор қабул қилишингизни сўрайман.'),
  ...signatureBlockOffenderCY(),
];

const T_JIN_APPEAL_RU: BlockSpec[] = [
  ...jinAppellateHeaderRU(),
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'правонарушитель, привлечённый к административной ответственности постановлением', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{lower_court_name}} от {{order_day}}.{{order_month}}.{{order_year}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_fio}}', italics: true, bold: true }], leftIndent: PARTY_INDENT },
  { text: '' },
  ...titleBlock('{{instance_type_title}}', 'на решение об административном наказании'),
  body('Постановлением {{lower_court_name}} от {{order_day}}.{{order_month}}.{{order_year}} я был(а) признан(а) виновным(ой) по статье {{mjtk_article}} МЖтК Республики Узбекистан, и в отношении меня применено административное наказание.'),
  body('С данным решением {{lower_court_name}} я не согласен(а) и считаю его несправедливым по следующим основаниям:'),
  body('{{disagreement_reasons}}'),
  body('Иные доказательства, свидетели и обстоятельства по делу:'),
  body('{{additional_evidence}}'),
  body('На основании изложенного прошу пересмотреть материалы дела об административном правонарушении в {{instance_type_label}} инстанции, изучить приведённые доводы и принять справедливое решение.'),
  ...signatureBlockOffenderRU(),
];

/* ============================================================
 * Template — Жиноят: МЖтК 324³ (restore appellate deadline)
 *   iltimosnoma-jinoyat-3243 (T_JIN_3243)
 * ============================================================ */
const T_JIN_3243_CY: BlockSpec[] = [
  ...jinTergovHeaderCY(),
  ...partyBlockCY('Аризачи', 'plaintiff'),
  ...titleBlock('И Л Т И М О С Н О М А', 'Ўзбекистон Республикаси МЖтКнинг 324³-моддаси тартибида'),
  body('{{district_court_name}}нинг {{order_day}}.{{order_month}}.{{order_year}} кунги қарори билан мен Ўзбекистон Республикаси МЖтКнинг {{mjtk_article}}-моддаси билан айбли деб топилиб, менга нисбатан маъмурий жазо қўлланган экан.'),
  body('Мени маъмурий жавобгарликка тортишга оид қарор қабул қилинганлигини {{learned_day}}.{{learned_month}}.{{learned_year}} йилда {{learned_how}} орқали билдим.'),
  body('Шу сабабли мен Ўзбекистон Республикаси МЖтКнинг 324³-моддасида кўрсатилган 10 суткалик шикоят бериш муддатини қуйидаги узрли сабабларга кўра ўтказиб юбордим:'),
  body('{{missing_reason}}'),
  body('Шу сабабли Сиздан узрли сабабларга кўра ўтказиб юборилган апелляция шикояти бериш муддатини тиклашингизни ва апелляция шикоятимни расмийлаштириб, {{court_name}} вилоят судининг жиноят ишлари бўйича судлов ҳайъатига маъмурий иш материалини юборишингизни сўрайман.'),
  ...signatureBlockOffenderCY(),
];

const T_JIN_3243_RU: BlockSpec[] = [
  ...jinTergovHeaderRU(),
  ...partyBlockRU('Заявитель', 'plaintiff'),
  ...titleBlock('Х О Д А Т А Й С Т В О', 'в порядке статьи 324³ МЖтК Республики Узбекистан'),
  body('Постановлением {{district_court_name}} от {{order_day}}.{{order_month}}.{{order_year}} я был(а) признан(а) виновным(ой) по статье {{mjtk_article}} МЖтК Республики Узбекистан, и в отношении меня применено административное наказание.'),
  body('О вынесении данного постановления я узнал(а) {{learned_day}}.{{learned_month}}.{{learned_year}} через {{learned_how}}.'),
  body('Установленный статьёй 324³ МЖтК 10-суточный срок апелляционного обжалования был пропущен по следующим уважительным причинам:'),
  body('{{missing_reason}}'),
  body('На основании изложенного прошу восстановить пропущенный по уважительной причине срок апелляционного обжалования, оформить мою апелляционную жалобу и направить материалы административного дела в судебную коллегию по уголовным делам областного суда {{court_name}}.'),
  ...signatureBlockOffenderRU(),
];

/* ============================================================
 * Template — Жиноят: Шикоят ариза (жаримани камайтириш) &
 *            Илтимоснома (шикоят муддатини тиклаш)
 *
 * Both address the tergov-sudya and have an applicant «from» block that
 * branches org vs individual. document.service sets
 * `applicant_is_org` / `applicant_is_individual`; the standalone
 * `{{#…}}` / `{{/…}}` paragraphs are stripped by paragraphLoop:true so
 * only the matching variant survives.
 * ============================================================ */

/** Applicant «from» block (right column) with org/individual variants.
 *  `withPhone` adds a «Тел:» line (Шикоят has it, Илтимоснома does not). */
const jinApplicantPartyBlockCY = (withPhone: boolean): BlockSpec[] => [
  { text: '{{#applicant_is_individual}}' },
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_fio}}', bold: true, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'томонидан', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{/applicant_is_individual}}' },
  { text: '{{#applicant_is_org}}' },
  { text: [{ text: '{{plaintiff_org_name}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'раҳбари {{plaintiff_fio}}', bold: true, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'томонидан', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{/applicant_is_org}}' },
  ...(withPhone
    ? [{ text: [{ text: 'Тел: {{plaintiff_phone}}', bold: true, italics: true }], leftIndent: PARTY_INDENT } as BlockSpec]
    : []),
  { text: '' },
];

const jinApplicantPartyBlockRU = (withPhone: boolean): BlockSpec[] => [
  { text: '{{#applicant_is_individual}}' },
  { text: [{ text: '{{plaintiff_address_line1}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: '{{plaintiff_address_line2}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'от {{plaintiff_fio}}', bold: true, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{/applicant_is_individual}}' },
  { text: '{{#applicant_is_org}}' },
  { text: [{ text: '{{plaintiff_org_name}}', italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: [{ text: 'в лице руководителя {{plaintiff_fio}}', bold: true, italics: true }], leftIndent: PARTY_INDENT, spaceAfter: TIGHT },
  { text: '{{/applicant_is_org}}' },
  ...(withPhone
    ? [{ text: [{ text: 'Тел: {{plaintiff_phone}}', bold: true, italics: true }], leftIndent: PARTY_INDENT } as BlockSpec]
    : []),
  { text: '' },
];

/** Signature block branching org («Раҳбар: … муҳр») vs individual. */
const jinApplicantSignatureCY = (): BlockSpec[] => [
  { text: '{{#applicant_is_individual}}' },
  ...signatureBlock('Аризачи:'),
  { text: '{{/applicant_is_individual}}' },
  { text: '{{#applicant_is_org}}' },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Раҳбар:', bold: true },
    { text: `${SIGNATURE_GAP}(имзо ва муҳр)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '{{/applicant_is_org}}' },
];

const jinApplicantSignatureRU = (): BlockSpec[] => [
  { text: '{{#applicant_is_individual}}' },
  ...signatureBlockRU('Заявитель:'),
  { text: '{{/applicant_is_individual}}' },
  { text: '{{#applicant_is_org}}' },
  { text: '' },
  { text: '' },
  { text: [
    { text: 'Руководитель:', bold: true },
    { text: `${SIGNATURE_GAP}(подпись и печать)${BLOCK_GAP}` },
    { text: '{{plaintiff_fio}}', bold: true },
  ] },
  { text: '{{/applicant_is_org}}' },
];

const T_JIN_JARIMA_CY: BlockSpec[] = [
  ...jinTergovHeaderCY(),
  ...jinApplicantPartyBlockCY(true),
  ...titleBlock('Ш И К О Я Т   А Р И З А', 'қўлланилган маъмурий жаримани камайтириш тўғрисида'),
  body('Мазмуни шундан иборатки, {{penalty_org}} томонидан {{order_day}}.{{order_month}}.{{order_year}} йил куни Ўзбекистон Республикаси МЖтКнинг {{mjtk_article}}-моддаси {{mjtk_part}}-қисми билан базавий ҳисоблаш миқдорининг {{base_multiplier}} баравари миқдорида {{fine_amount}} сўм жарима тайинланган.'),
  body('Ушбу жаримани тўлашга имкониятим йўқ, сабаби: {{reason}}'),
  body('Юқоридагиларни инобатга олиб, қўлланилган жаримани камайтириб беришингизни сўрайман.'),
  { text: '' },
  ...attachmentBlock('Илова:', [
    'Паспорт нусхаси;',
    'Жарима солиш тўғрисидаги қарор;',
    'Ҳуқуқбузарлик ҳолати олинган расм / солиқ ҳисоботи маълумотномаси;',
    'Талабнома (ИИБдан олса бўлади);',
    'Ойлик иш ҳаққи тўғрисидаги маълумотнома (бўлса);',
    'Маҳалладан оилавий шароит ҳақида далолатнома;',
    'Жаримани камайтириш учун асос бўладиган бошқа ҳужжатлар.',
  ]),
  ...jinApplicantSignatureCY(),
];

const T_JIN_JARIMA_RU: BlockSpec[] = [
  ...jinTergovHeaderRU(),
  ...jinApplicantPartyBlockRU(true),
  ...titleBlock('Ж А Л О Б А', 'об уменьшении наложенного административного штрафа'),
  body('Настоящим сообщаю, что {{penalty_org}} {{order_day}}.{{order_month}}.{{order_year}} в отношении меня вынесено постановление о наложении штрафа по статье {{mjtk_article}} части {{mjtk_part}} МЖтК Республики Узбекистан в размере {{base_multiplier}}-кратной базовой расчётной величины, что составляет {{fine_amount}} сум.'),
  body('У меня нет возможности оплатить данный штраф, причина: {{reason}}'),
  body('На основании изложенного прошу уменьшить наложенный штраф.'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'Копия паспорта;',
    'Постановление о наложении штрафа;',
    'Снимок правонарушения / справка о налоговой отчётности;',
    'Требование (можно получить в ОВД);',
    'Справка о заработной плате (при наличии);',
    'Справка из махалли о семейном положении;',
    'Иные документы — основание для снижения штрафа.',
  ]),
  ...jinApplicantSignatureRU(),
];

const T_JIN_MUDDAT_CY: BlockSpec[] = [
  ...jinTergovHeaderCY(),
  ...jinApplicantPartyBlockCY(false),
  ...titleBlock('И Л Т И М О С Н О М А', 'шикоят бериш муддатини тиклаш тўғрисида'),
  body('Мазмуни шундан иборатки, {{penalty_org}} томонидан {{order_day}}.{{order_month}}.{{order_year}} йил куни менга нисбатан {{fine_amount}} сўм маъмурий жарима қўллаш тўғрисида қарор қабул қилинган.'),
  body('Ушбу қарорни {{late_reason}} шу сабабли ўз вақтида олмаганман.'),
  body('Мазкур қарорни {{learned_day}}.{{learned_month}}.{{learned_year}} йил куни {{learned_where}} орқали олганман, шу боис қарор устидан шикоят бериш муддати ўтиб кетган.'),
  body('Юқоридагиларни инобатга олиб, ушбу қарор бўйича шикоят бериш муддатини тиклаб беришингизни сўрайман.'),
  { text: '' },
  ...attachmentBlock('Илова:', [
    'Паспорт нусхаси;',
    'Жарима солиш тўғрисидаги қарор;',
    'Нима сабабдан шикоят бериш муддати ўтиб кетганлиги ҳақида маълумотнома.',
  ]),
  ...jinApplicantSignatureCY(),
];

const T_JIN_MUDDAT_RU: BlockSpec[] = [
  ...jinTergovHeaderRU(),
  ...jinApplicantPartyBlockRU(false),
  ...titleBlock('Х О Д А Т А Й С Т В О', 'о восстановлении срока подачи жалобы'),
  body('Настоящим сообщаю, что {{penalty_org}} {{order_day}}.{{order_month}}.{{order_year}} в отношении меня вынесено постановление о наложении административного штрафа в размере {{fine_amount}} сум.'),
  body('Данное постановление я не получил(а) вовремя по причине: {{late_reason}}'),
  body('Указанное постановление я получил(а) {{learned_day}}.{{learned_month}}.{{learned_year}} через {{learned_where}}, в связи с чем срок подачи жалобы на постановление был пропущен.'),
  body('На основании изложенного прошу восстановить срок подачи жалобы по данному постановлению.'),
  { text: '' },
  ...attachmentBlock('Приложение:', [
    'Копия паспорта;',
    'Постановление о наложении штрафа;',
    'Справка о причине пропуска срока подачи жалобы.',
  ]),
  ...jinApplicantSignatureRU(),
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
  'davo-ariza-otalik-aliment': {
    uz_cyrillic: T8_CY,
    uz_latin: deriveLatin(T8_CY),
    ru: T8_RU,
  },
  'davo-ariza-bolani-olish': {
    uz_cyrillic: T9_CY,
    uz_latin: deriveLatin(T9_CY),
    ru: T9_RU,
  },
  'davo-ariza-uy-kiritish': {
    uz_cyrillic: T10_CY,
    uz_latin: deriveLatin(T10_CY),
    ru: T10_RU,
  },
  'davo-ariza-uy-kochirish': {
    uz_cyrillic: T11_CY,
    uz_latin: deriveLatin(T11_CY),
    ru: T11_RU,
  },
  'davo-ariza-mol-mulkni-olish': {
    uz_cyrillic: T12_CY,
    uz_latin: deriveLatin(T12_CY),
    ru: T12_RU,
  },
  'davo-ariza-qarz-undirish': {
    uz_cyrillic: T13_CY,
    uz_latin: deriveLatin(T13_CY),
    ru: T13_RU,
  },
  'davo-ariza-pul-undirish': {
    uz_cyrillic: T14_CY,
    uz_latin: deriveLatin(T14_CY),
    ru: T14_RU,
  },
  'ariza-jinoyat-nuskha': {
    uz_cyrillic: T_JIN_NUSHA_CY,
    uz_latin: deriveLatin(T_JIN_NUSHA_CY),
    ru: T_JIN_NUSHA_RU,
  },
  'ariza-jinoyat-315': {
    uz_cyrillic: T_JIN_315_CY,
    uz_latin: deriveLatin(T_JIN_315_CY),
    ru: T_JIN_315_RU,
  },
  'iltimosnoma-jinoyat-316': {
    uz_cyrillic: T_JIN_316_CY,
    uz_latin: deriveLatin(T_JIN_316_CY),
    ru: T_JIN_316_RU,
  },
  'ariza-jinoyat-tanishuv': {
    uz_cyrillic: T_JIN_TANISH_CY,
    uz_latin: deriveLatin(T_JIN_TANISH_CY),
    ru: T_JIN_TANISH_RU,
  },
  'shikoyat-jinoyat-apellyatsiya': {
    uz_cyrillic: T_JIN_APPEAL_CY,
    uz_latin: deriveLatin(T_JIN_APPEAL_CY),
    ru: T_JIN_APPEAL_RU,
  },
  'iltimosnoma-jinoyat-3243': {
    uz_cyrillic: T_JIN_3243_CY,
    uz_latin: deriveLatin(T_JIN_3243_CY),
    ru: T_JIN_3243_RU,
  },
  'shikoyat-jinoyat-jarima': {
    uz_cyrillic: T_JIN_JARIMA_CY,
    uz_latin: deriveLatin(T_JIN_JARIMA_CY),
    ru: T_JIN_JARIMA_RU,
  },
  'iltimosnoma-jinoyat-muddat': {
    uz_cyrillic: T_JIN_MUDDAT_CY,
    uz_latin: deriveLatin(T_JIN_MUDDAT_CY),
    ru: T_JIN_MUDDAT_RU,
  },
  'ariza-mamuriy-mansabdor': {
    uz_cyrillic: T_MAM_MANSABDOR_CY,
    uz_latin: deriveLatin(T_MAM_MANSABDOR_CY),
    ru: T_MAM_MANSABDOR_RU,
  },
  'ariza-mamuriy-qaror-bekor': {
    uz_cyrillic: T_MAM_QAROR_BEKOR_CY,
    uz_latin: deriveLatin(T_MAM_QAROR_BEKOR_CY),
    ru: T_MAM_QAROR_BEKOR_RU,
  },
  'iltimosnoma-mamuriy-goshlina': {
    uz_cyrillic: T_MAM_GOSHLINA_CY,
    uz_latin: deriveLatin(T_MAM_GOSHLINA_CY),
    ru: T_MAM_GOSHLINA_RU,
  },
  'ariza-mamuriy-zarar': {
    uz_cyrillic: T_MAM_ZARAR_CY,
    uz_latin: deriveLatin(T_MAM_ZARAR_CY),
    ru: T_MAM_ZARAR_RU,
  },
  'ariza-mamuriy-npa-bekor': {
    uz_cyrillic: T_MAM_NPA_CY,
    uz_latin: deriveLatin(T_MAM_NPA_CY),
    ru: T_MAM_NPA_RU,
  },
  'iltimosnoma-mamuriy-toxtatish': {
    uz_cyrillic: T_MAM_TOXTAT_CY,
    uz_latin: deriveLatin(T_MAM_TOXTAT_CY),
    ru: T_MAM_TOXTAT_RU,
  },
  'shikoyat-mamuriy-pristav': {
    uz_cyrillic: T_MAM_PRISTAV_CY,
    uz_latin: deriveLatin(T_MAM_PRISTAV_CY),
    ru: T_MAM_PRISTAV_RU,
  },
  'ariza-iqtisodiy-sud-buyrug': {
    uz_cyrillic: T_IQT_SUD_BUYRUG_CY,
    uz_latin: deriveLatin(T_IQT_SUD_BUYRUG_CY),
    ru: T_IQT_SUD_BUYRUG_RU,
  },
  'ariza-iqtisodiy-ijro-tiklash': {
    uz_cyrillic: T_IQT_IJRO_TIKLA_CY,
    uz_latin: deriveLatin(T_IQT_IJRO_TIKLA_CY),
    ru: T_IQT_IJRO_TIKLA_RU,
  },
  'shikoyat-iqtisodiy-apellyatsiya': {
    uz_cyrillic: T_IQT_APELL_CY,
    uz_latin: deriveLatin(T_IQT_APELL_CY),
    ru: T_IQT_APELL_RU,
  },
  'shikoyat-iqtisodiy-kassatsiya': {
    uz_cyrillic: T_IQT_KASS_CY,
    uz_latin: deriveLatin(T_IQT_KASS_CY),
    ru: T_IQT_KASS_RU,
  },
  'davo-ariza-manaviy-zarar': {
    uz_cyrillic: T_DAVO_MANAVIY_ZARAR_CY,
    uz_latin: deriveLatin(T_DAVO_MANAVIY_ZARAR_CY),
    ru: T_DAVO_MANAVIY_ZARAR_RU,
  },
  'ariza-hujjatdan-nuskha': {
    uz_cyrillic: T15_CY,
    uz_latin: deriveLatin(T15_CY),
    ru: T15_RU,
  },
  'ariza-yangi-holat-bekor': {
    uz_cyrillic: T16_CY,
    uz_latin: deriveLatin(T16_CY),
    ru: T16_RU,
  },
  'ariza-ijroni-kechiktirish': {
    uz_cyrillic: T17_CY,
    uz_latin: deriveLatin(T17_CY),
    ru: T17_RU,
  },
  'appellatsiya-shikoyati': {
    uz_cyrillic: T18_CY,
    uz_latin: deriveLatin(T18_CY),
    ru: T18_RU,
  },
  'taftish-shikoyati': {
    uz_cyrillic: T19_CY,
    uz_latin: deriveLatin(T19_CY),
    ru: T19_RU,
  },
  'kassatsiya-shikoyati': {
    uz_cyrillic: T20_CY,
    uz_latin: deriveLatin(T20_CY),
    ru: T20_RU,
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
