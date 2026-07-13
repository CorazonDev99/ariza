import fs from 'node:fs/promises';
import path from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require('docxtemplater-image-module-free');
import { DocxGenerationError, TemplateNotFoundError } from '../utils/errors';
import { ensureDir, fileExists } from '../utils/fs';
import { logger } from '../utils/logger';

export interface DocxRenderInput {
  templatePath: string;
  data: Record<string, unknown>;
  /**
   * Map of image-tag-name → PNG Buffer.
   * In templates these are referenced as `{{%tag}}`.
   */
  images?: Record<string, Buffer>;
  outputPath: string;
}

/**
 * Generates a .docx file from a docxtemplater template.
 * Uses `{{` / `}}` delimiters and the free image module so templates
 * can contain `{{%qr_code}}` placeholders.
 */
export class DocxService {
  async generate(input: DocxRenderInput): Promise<string> {
    const { templatePath, data, outputPath, images = {} } = input;

    if (!(await fileExists(templatePath))) {
      throw new TemplateNotFoundError(
        `Template file not found: ${templatePath}`,
      );
    }

    try {
      const content = await fs.readFile(templatePath);
      const zip = new PizZip(content);

      const imageModule = new ImageModule({
        centered: false,
        fileType: 'docx',
        getImage: (tagValue: unknown): Buffer => {
          if (Buffer.isBuffer(tagValue)) return tagValue;
          if (typeof tagValue === 'string' && tagValue.startsWith('__img:')) {
            const key = tagValue.slice('__img:'.length);
            const buf = images[key];
            if (buf) return buf;
          }
          throw new DocxGenerationError(
            `Image tag value is not a Buffer: ${typeof tagValue}`,
          );
        },
        getSize: (): [number, number] => [70, 70],
      });

      const doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
      });

      // Inject image tags as `__img:<key>` so getImage knows which buffer to use.
      const mergedData: Record<string, unknown> = { ...data };
      for (const key of Object.keys(images)) {
        mergedData[key] = `__img:${key}`;
      }

      doc.render(mergedData);

      const buffer = doc
        .getZip()
        .generate({ type: 'nodebuffer', compression: 'DEFLATE' });

      await ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, buffer);

      logger.info({ outputPath }, 'DOCX generated');
      return outputPath;
    } catch (err) {
      if (err instanceof TemplateNotFoundError) throw err;
      const e = err as Error & {
        properties?: { errors?: Array<{ message: string }> };
      };
      // docxtemplater tag errors live in `properties.errors`; anything
      // else (a filesystem write error, a PizZip failure, etc.) only has
      // a plain `message` — surface it too so the real cause isn't hidden
      // behind a generic "Failed to render DOCX".
      const inner = e.properties?.errors?.map((x) => x.message).join('; ');
      const detail =
        inner || (err instanceof Error ? err.message : String(err));
      logger.error(
        { err, templatePath, outputPath },
        'DOCX render failed',
      );
      throw new DocxGenerationError(
        `Failed to render DOCX${detail ? `: ${detail}` : ''}`,
        err,
      );
    }
  }
}
