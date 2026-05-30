import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config';
import type { DocumentRepository } from '../repositories/document.repository';
import { getTemplateByCode } from '../templates/registry';
import type { DocumentFormat, Values } from '../types';
import type { Locale } from '../i18n';
import { TemplateNotFoundError } from '../utils/errors';
import { safeFileName, fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import { buildDownloadUrl, generateQrPng } from '../utils/qrcode';
import type { DocxService } from './docx.service';
import type { PdfService } from './pdf.service';
import type { TemplateService } from './template.service';

/**
 * Split a user-typed single-line address into two visual lines for the
 * .docx template. Prefers breaking right after a "MFY" / "МФЙ" / "махалля"
 * keyword (so part 1 = locality, part 2 = street/house); otherwise
 * splits at the comma closest to the midpoint.
 */
export function splitAddressForDoc(addr: string): {
  line1: string;
  line2: string;
} {
  const trimmed = addr.trim();
  if (!trimmed) return { line1: '', line2: '' };

  // Keyword-based split — most reliable when present.
  const kw = /^([\s\S]*?(?:MFY|МФЙ|махалл[аи]|МФЙи))\s*,\s*([\s\S]+)$/iu.exec(
    trimmed,
  );
  if (kw) return { line1: kw[1]!.trim(), line2: kw[2]!.trim() };

  // Fallback — split at the comma closest to the string midpoint so
  // both halves end up roughly the same length.
  const parts = trimmed.split(/\s*,\s*/);
  if (parts.length < 2) return { line1: trimmed, line2: '' };
  const mid = Math.ceil(parts.length / 2);
  return {
    line1: parts.slice(0, mid).join(', '),
    line2: parts.slice(mid).join(', '),
  };
}

/**
 * Build the children-block sentence inserted as a single paragraph in
 * the .docx output. Single-child case matches the sample form's wording
 * ("Биргаликдаги турмушимиздан 1 нафар <DOB> туғилган <name> исмли
 * фарзандим бор."). Multi-child case enumerates with "1) ...; 2) ...".
 */
function buildChildrenBlock(
  values: Record<string, string>,
  locale: Locale,
): string {
  type Child = { name: string; y?: string; m?: string; d?: string };
  // Trust `children_count` as the authoritative number. Skipped child
  // fields are filled with "—" by the wizard's skipIf logic; we must not
  // include those in the rendered block.
  const declared = Number(values.children_count ?? '0');
  if (!Number.isFinite(declared) || declared <= 0) return '';
  const kids: Child[] = [];
  for (let i = 1; i <= declared && i <= 6; i++) {
    const name = values[`child${i}_name`];
    if (!name || name === '—' || /^_+$/.test(name)) continue;
    kids.push({
      name,
      y: values[`child${i}_dob_year`],
      m: values[`child${i}_dob_month`],
      d: values[`child${i}_dob_day`],
    });
  }
  if (kids.length === 0) return '';

  const count = String(kids.length);

  const dob = (k: Child): string => {
    if (!k.y || !k.m || !k.d) return '';
    switch (locale) {
      case 'uz_cyrillic':
        return `${k.y} йил ${k.m} ойининг ${k.d} кунида туғилган`;
      case 'uz_latin':
        return `${k.y} yil ${k.m} oyining ${k.d} kunida tug‘ilgan`;
      case 'ru':
        return `${k.d} ${k.m} ${k.y} года рождения`;
    }
  };

  if (kids.length === 1) {
    const k = kids[0]!;
    const d = dob(k);
    switch (locale) {
      case 'uz_cyrillic':
        return `Биргаликдаги турмушимиздан ${count} нафар ${d} ${k.name} исмли фарзандим бор.`;
      case 'uz_latin':
        return `Birgalikdagi turmushimizdan ${count} nafar ${d} ${k.name} ismli farzandim bor.`;
      case 'ru':
        return `От совместной жизни имеется ${count} ребёнок — ${k.name}, ${d}.`;
    }
  }

  const list = kids
    .map((k, i) => `${i + 1}) ${k.name}${dob(k) ? ', ' + dob(k) : ''}`)
    .join('; ');
  switch (locale) {
    case 'uz_cyrillic':
      return `Биргаликдаги турмушимиздан ${count} нафар фарзандларимиз бор: ${list}.`;
    case 'uz_latin':
      return `Birgalikdagi turmushimizdan ${count} nafar farzandlarimiz bor: ${list}.`;
    case 'ru':
      return `От совместной жизни имеется ${count} детей: ${list}.`;
  }
}

/**
 * In-place enrichment of the data object for T_ILTIMOSNOMA. Computes:
 *   - plaintiff_subject     — org name OR FIO depending on plaintiff_type
 *   - plaintiff_id_line     — "СТИР: …" / "ЖШШИР: …" / "ПИНФЛ: …"
 *   - defendantN_present    — boolean truthy/empty for docxtemplater conditionals
 *   - defendants_in_body    — short phrase used in the running body text
 *                             e.g. "жавобгарлар X ва Y дан" / "ответчику X"
 *
 * Why this lives outside the template script: the .docx is rendered as
 * a static blob, so any branching ("if plaintiff is an org…") has to be
 * resolved into plain strings before docxtemplater renders the file.
 */
/**
 * Localized noun phrase for the `case_type` choice in jinoyat templates,
 * inflected so it fits the body sentence "…рассматривалось <X> дело".
 */
function jinoyatCaseTypeLabel(
  value: 'jinoyat' | 'mamuriy',
  locale: Locale,
): string {
  if (locale === 'ru') {
    return value === 'jinoyat'
      ? 'уголовное дело'
      : 'дело об административном правонарушении';
  }
  if (locale === 'uz_latin') {
    return value === 'jinoyat'
      ? 'jinoyat ishi'
      : "ma'muriy huquqbuzarlik to‘g‘risidagi ish";
  }
  return value === 'jinoyat'
    ? 'жиноят иши'
    : 'маъмурий ҳуқуқбузарлик тўғрисидаги иш';
}

/** МЖтК 315 — verb that combines with "…қарорни <X>ингизни сўрайман". */
function jinoyatActionLabel(
  value: 'bekor' | 'ozgartirish',
  locale: Locale,
): string {
  if (locale === 'ru') {
    return value === 'bekor' ? 'отменить' : 'изменить';
  }
  if (locale === 'uz_latin') {
    return value === 'bekor' ? 'bekor qilish' : "o‘zgartirish";
  }
  return value === 'bekor' ? 'бекор қилиш' : 'ўзгартириш';
}

/** Tanishuv — "considered" (past) vs "being considered" (ongoing). */
function jinoyatCaseStatusLabel(
  value: 'considered' | 'in-progress',
  locale: Locale,
): string {
  if (locale === 'ru') {
    return value === 'considered' ? 'рассмотренного' : 'рассматривающегося';
  }
  if (locale === 'uz_latin') {
    return value === 'considered' ? "ko‘rilgan" : "ko‘rilayotgan";
  }
  return value === 'considered' ? 'кўрилган' : 'кўрилаётган';
}

/** Tanishuv — opening clause of the body, "in respect of whom" the case
 *  was about. Self vs through-victim wording is significantly different. */
function jinoyatTanishSubjectPhrase(
  partyRole: string | undefined,
  victimFio: string | undefined,
  locale: Locale,
): string {
  const isVictim = partyRole === 'victim';
  const fio = victimFio && victimFio !== '—' ? victimFio : '____________';
  if (locale === 'ru') {
    return isVictim
      ? `в отношении потерпевшего ${fio}`
      : 'в отношении меня';
  }
  if (locale === 'uz_latin') {
    return isVictim
      ? `men jabrlanuvchi bo‘lgan ${fio} nisbatan`
      : 'menga nisbatan';
  }
  return isVictim
    ? `мен жабрланувчи бўлган ${fio} нисбатан`
    : 'менга нисбатан';
}

/** Appellate complaint — centered title varies per instance. */
function jinoyatInstanceTitle(
  value: 'apellyatsiya' | 'kassatsiya',
  locale: Locale,
): string {
  if (locale === 'ru') {
    return value === 'apellyatsiya'
      ? 'А П Е Л Л Я Ц И О Н Н А Я   Ж А Л О Б А'
      : 'К А С С А Ц И О Н Н А Я   Ж А Л О Б А';
  }
  if (locale === 'uz_latin') {
    return value === 'apellyatsiya'
      ? 'A P E L L Y A T S I Y A   S H I K O Y A T I'
      : 'K A S S A T S I Y A   S H I K O Y A T I';
  }
  return value === 'apellyatsiya'
    ? 'А П Е Л Л Я Ц И Я   Ш И К О Я Т И'
    : 'К А С С А Ц И Я   Ш И К О Я Т И';
}

/** Appellate complaint — short noun form used in the body sentence. */
function jinoyatInstanceLabel(
  value: 'apellyatsiya' | 'kassatsiya',
  locale: Locale,
): string {
  if (locale === 'ru') {
    return value === 'apellyatsiya' ? 'апелляционной' : 'кассационной';
  }
  if (locale === 'uz_latin') {
    return value === 'apellyatsiya' ? 'apellyatsiya' : 'kassatsiya';
  }
  return value === 'apellyatsiya' ? 'апелляция' : 'кассация';
}

function enrichIltimosnomaData(
  data: Record<string, string>,
  values: Record<string, string>,
  locale: Locale,
): void {
  const isOrg = values.plaintiff_type === '1';

  // Subject = the name that appears wherever the body says "the plaintiff
  // ${X} requests…". Org name when юр.шахс, FIO when жисмоний шахс.
  const subject = isOrg
    ? values.plaintiff_org_name ?? '____________'
    : values.plaintiff_fio ?? '____________';
  data.plaintiff_subject = subject;

  // ID line on the right of the phone row in the plaintiff block.
  const stir = values.plaintiff_stir;
  const pinfl = values.plaintiff_pinfl;
  if (isOrg && stir && stir !== '—') {
    data.plaintiff_id_line = `СТИР: ${stir}`;
  } else if (!isOrg && pinfl && pinfl !== '—') {
    const label =
      locale === 'ru' ? 'ПИНФЛ' : locale === 'uz_latin' ? 'JSHSHIR' : 'ЖШШИР';
    data.plaintiff_id_line = `${label}: ${pinfl}`;
  } else {
    data.plaintiff_id_line = '';
  }

  // defendant1..3 — `_present` flag for docxtemplater conditional blocks.
  const declared = Math.min(3, Math.max(0, Number(values.defendants_count ?? '0')));
  for (let i = 1; i <= 3; i++) {
    data[`defendant${i}_present`] = i <= declared ? 'yes' : '';
  }

  // Body text inserts e.g. "жавобгарлар X ва Y ва Z дан" — needs the
  // FIOs listed inline. Single-defendant uses singular form.
  const names: string[] = [];
  for (let i = 1; i <= declared; i++) {
    const fio = values[`defendant${i}_fio`];
    if (fio && fio !== '—') names.push(fio);
  }
  data.defendants_in_body = formatDefendantsInBody(names, locale);
}

function formatDefendantsInBody(names: string[], locale: Locale): string {
  if (names.length === 0) return '____________';
  switch (locale) {
    case 'ru':
      return names.length === 1
        ? `ответчику ${names[0]}`
        : `ответчикам ${joinWithAnd(names, ' и ')}`;
    case 'uz_latin':
      // "javobgar X dan" / "javobgarlar X va Y dan" — postpositional -dan.
      return names.length === 1
        ? `javobgar ${names[0]}dan`
        : `javobgarlar ${joinWithAnd(names, ' va ')}dan`;
    case 'uz_cyrillic':
      return names.length === 1
        ? `жавобгар ${names[0]}дан`
        : `жавобгарлар ${joinWithAnd(names, ' ва ')}дан`;
  }
}

function joinWithAnd(names: string[], sep: string): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return names.slice(0, -1).join(', ') + sep + names[names.length - 1];
}

export interface BuildDocumentInput {
  userId: number;
  templateDbId: number;
  templateCode: string;
  values: Values;
  format: DocumentFormat;
  locale: Locale;
  paymentId?: number;
}

export interface BuildDocumentResult {
  filePath: string;
  format: DocumentFormat;
  documentId: number;
  downloadToken: string;
  downloadUrl: string;
  qrPng: Buffer;
}

export class DocumentService {
  constructor(
    private readonly templates: TemplateService,
    private readonly docx: DocxService,
    private readonly pdf: PdfService,
    private readonly documents: DocumentRepository,
  ) {}

  async build(input: BuildDocumentInput): Promise<BuildDocumentResult> {
    const dbTemplate = await this.templates.getByIdOrThrow(input.templateDbId);
    const def = getTemplateByCode(input.templateCode);
    if (!def) {
      throw new TemplateNotFoundError(
        `Template definition not found: ${input.templateCode}`,
      );
    }

    const templatePath = this.resolveTemplatePath(def.fileNameBase, input.locale);
    if (!(await fileExists(templatePath))) {
      throw new TemplateNotFoundError(
        `Template file missing for locale ${input.locale}: ${templatePath}`,
      );
    }

    // Start with everything the wizard collected (this also carries
    // pre-filled court_name/judge_name from the region step), then fall
    // back to per-field defaults for any user-input field still empty.
    const data: Record<string, string> = { ...input.values };
    for (const f of def.fields) {
      if (data[f.key] === undefined || data[f.key] === '') {
        data[f.key] = f.defaultValue ?? '____________';
      }
    }

    // "Қарор чиқарган суд" / "Иш қаралган суд" (lower_court_name /
    // issuing_court_name) is NEVER asked — it carries the court the user
    // already picked. "Иш рақами" (case_number) is also not asked: it's
    // rendered as a manual fill-in blank on the printed form. Set both
    // here so the .docx placeholders resolve regardless of template.
    const pickedCourt = input.values.district_court_name;
    const COURT_BLANK = '______________________________';
    const CASE_BLANK = '____________________';
    data.lower_court_name =
      pickedCourt && pickedCourt !== '____________' ? pickedCourt : COURT_BLANK;
    data.issuing_court_name = data.lower_court_name;
    data.case_number = CASE_BLANK;

    // Split each single-line address into two `_line1` / `_line2`
    // sub-keys so the .docx template can render the address on two
    // visual lines (matches the printable form layout). Split point is
    // the comma after a "MFY" / "МФЙ" / "махалля" keyword; if no such
    // keyword is found, splits at the middle comma.
    for (const base of [
      'collector',
      'debtor',
      'plaintiff',
      'defendant',
      'defendant1',
      'defendant2',
      'defendant3',
    ]) {
      const addr = input.values[`${base}_address`];
      if (!addr) continue;
      const { line1, line2 } = splitAddressForDoc(addr);
      data[`${base}_address_line1`] = line1;
      data[`${base}_address_line2`] = line2;
    }

    // Iltimosnoma-specific pre-computed values. The template (T6) varies
    // its plaintiff block by type (org vs natural person) and renders
    // up to 3 defendants via `{{#defendantN_present}}` blocks. Compute
    // these once here so the .docx itself stays static.
    if (input.templateCode === 'iltimosnoma-ishtiroksiz') {
      enrichIltimosnomaData(data, input.values, input.locale);
    }

    // Jinoyat (criminal-court) templates: translate the `case_type`
    // choice ('jinoyat' / 'mamuriy') into a localized noun phrase so
    // the body sentence reads naturally regardless of selection.
    const caseType = input.values.case_type;
    if (caseType === 'jinoyat' || caseType === 'mamuriy') {
      data.case_type_label = jinoyatCaseTypeLabel(caseType, input.locale);
    }

    // Jinoyat MЖтК 315: localize the cancel/modify action verb so
    // the body sentence "…қарорни <X>ингизни сўрайман" reads right.
    const actionType = input.values.action_type;
    if (actionType === 'bekor' || actionType === 'ozgartirish') {
      data.action_type_label = jinoyatActionLabel(actionType, input.locale);
    }

    // Jinoyat tanishuv: case_status ('considered' / 'in-progress').
    const caseStatus = input.values.case_status;
    if (caseStatus === 'considered' || caseStatus === 'in-progress') {
      data.case_status_label = jinoyatCaseStatusLabel(caseStatus, input.locale);
    }

    // Jinoyat tanishuv: build the subject phrase that opens the body
    // ("менга нисбатан" vs "мен жабрланувчи бўлган <FIO> нисбатан").
    if (input.templateCode === 'ariza-jinoyat-tanishuv') {
      data.tanish_subject_phrase = jinoyatTanishSubjectPhrase(
        input.values.party_role,
        input.values.victim_fio,
        input.locale,
      );
    }

    // Jinoyat appellate complaint: title differs per instance type, and
    // the body uses a noun form of the instance ("апелляция" / "кассация").
    const instanceType = input.values.instance_type;
    if (instanceType === 'apellyatsiya' || instanceType === 'kassatsiya') {
      data.instance_type_title = jinoyatInstanceTitle(instanceType, input.locale);
      data.instance_type_label = jinoyatInstanceLabel(instanceType, input.locale);
    }

    // Build the single combined `children_block` paragraph used by the
    // .docx templates. Matches the sample form's wording for 1 child and
    // enumerates for 2+. Legacy `children_names` / `children_birth_date`
    // are still produced for older templates that haven't been migrated.
    data.children_block = buildChildrenBlock(input.values, input.locale);
    const declared = Number(input.values.children_count ?? '0');
    const childNames: string[] = [];
    const childDobs: string[] = [];
    for (let i = 1; i <= declared && i <= 6; i++) {
      const name = input.values[`child${i}_name`];
      const dob = input.values[`child${i}_dob`];
      if (!name || name === '—' || /^_+$/.test(name)) continue;
      childNames.push(`${i}. ${name}`);
      if (dob && dob !== '—') childDobs.push(`${name} — ${dob}`);
    }
    if (childNames.length) data.children_names = childNames.join('\n');
    if (childDobs.length) data.children_birth_date = childDobs.join('; ');

    const downloadToken = crypto.randomBytes(16).toString('hex');
    const downloadUrl = buildDownloadUrl(downloadToken);
    const qrPng = await generateQrPng(downloadUrl);

    const baseName =
      data.plaintiff_fio ?? data.collector_fio ?? def.code;
    const fileBase = safeFileName(
      `${def.code}_${input.locale}_${baseName}_${Date.now()}`,
    );
    const docxPath = path.join(config.outputDir, `${fileBase}.docx`);

    // QR is no longer embedded in the document — it's sent only as a
    // separate photo message after the file. `qrPng` is still returned
    // in BuildDocumentResult for that purpose.
    await this.docx.generate({
      templatePath,
      data,
      outputPath: docxPath,
    });

    let finalPath = docxPath;
    if (input.format === 'pdf') {
      finalPath = await this.pdf.convert(docxPath, config.outputDir);
    }

    const doc = await this.documents.create({
      userId: input.userId,
      templateId: dbTemplate.id,
      format: input.format,
      filePath: finalPath,
      language: input.locale,
      paymentId: input.paymentId,
      downloadToken,
    });

    logger.info(
      {
        userId: input.userId,
        templateId: dbTemplate.id,
        format: input.format,
        locale: input.locale,
        downloadToken,
        filePath: finalPath,
      },
      'Document generated',
    );

    return {
      filePath: finalPath,
      format: input.format,
      documentId: doc.id,
      downloadToken,
      downloadUrl,
      qrPng,
    };
  }

  private resolveTemplatePath(base: string, locale: Locale): string {
    return path.resolve(config.templatesDir, `${base}.${locale}.docx`);
  }
}
