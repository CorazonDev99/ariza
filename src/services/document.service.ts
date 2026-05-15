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

    const downloadToken = crypto.randomBytes(16).toString('hex');
    const downloadUrl = buildDownloadUrl(downloadToken);
    const qrPng = await generateQrPng(downloadUrl);

    const baseName =
      data.plaintiff_fio ?? data.collector_fio ?? def.code;
    const fileBase = safeFileName(
      `${def.code}_${input.locale}_${baseName}_${Date.now()}`,
    );
    const docxPath = path.join(config.outputDir, `${fileBase}.docx`);

    await this.docx.generate({
      templatePath,
      data,
      images: { qr_code: qrPng },
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
