import path from 'node:path';
import { config } from '../config';
import { LOCALES } from '../i18n';
import type { TemplateRepository } from '../repositories/template.repository';
import { TEMPLATES } from '../templates/registry';
import { fileExists, ensureDir } from '../utils/fs';
import { logger } from '../utils/logger';

/**
 * Idempotent startup task: upsert templates from the registry,
 * warn if any locale .docx file is missing.
 */
export class SeedService {
  constructor(private readonly templates: TemplateRepository) {}

  async run(): Promise<void> {
    await ensureDir(config.templatesDir);
    let registered = 0;
    let missing = 0;

    for (const def of TEMPLATES) {
      const filePath = path.resolve(
        config.templatesDir,
        `${def.fileNameBase}.uz_cyrillic.docx`,
      );
      await this.templates.upsert({
        code: def.code,
        category: def.category,
        title: def.title.uz_cyrillic,
        subtitle: def.subtitle.uz_cyrillic,
        description: def.description.uz_cyrillic,
        filePath,
        active: true,
      });
      registered += 1;

      for (const loc of LOCALES) {
        const p = path.resolve(
          config.templatesDir,
          `${def.fileNameBase}.${loc}.docx`,
        );
        if (!(await fileExists(p))) {
          missing += 1;
          logger.warn(
            { code: def.code, locale: loc, expected: p },
            'Template .docx file is missing — run `npm run template:sample`',
          );
        }
      }
    }

    logger.info({ registered, missing }, 'Template registry synced');
  }
}
