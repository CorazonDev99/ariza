import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config';
import { PdfConversionError } from '../utils/errors';
import { ensureDir, fileExists, withExt } from '../utils/fs';
import { logger } from '../utils/logger';

/**
 * Converts DOCX to PDF using a headless LibreOffice binary.
 * LibreOffice writes the output PDF into the provided --outdir
 * with the same base name as the input file.
 */
export class PdfService {
  async convert(docxPath: string, outputDir?: string): Promise<string> {
    if (!(await fileExists(docxPath))) {
      throw new PdfConversionError(`DOCX not found: ${docxPath}`);
    }

    const outDir = outputDir ?? path.dirname(docxPath);
    await ensureDir(outDir);

    const args = [
      '--headless',
      '--norestore',
      '--nologo',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      docxPath,
    ];

    logger.debug(
      { bin: config.libreofficeBin, args },
      'Running LibreOffice conversion',
    );

    await this.runLibreOffice(args);

    const expected = withExt(
      path.join(outDir, path.basename(docxPath)),
      'pdf',
    );

    if (!(await fileExists(expected))) {
      throw new PdfConversionError(
        `LibreOffice did not produce expected PDF at ${expected}`,
      );
    }

    // Touch file to ensure it's flushed (defensive on Windows).
    await fs.stat(expected);
    logger.info({ pdfPath: expected }, 'PDF generated');
    return expected;
  }

  private runLibreOffice(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(config.libreofficeBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.stdout.on('data', (chunk) => {
        logger.debug({ out: chunk.toString().trim() }, 'soffice stdout');
      });

      child.on('error', (err) => {
        reject(
          new PdfConversionError(
            `Failed to start LibreOffice (${config.libreofficeBin}): ${err.message}`,
            err,
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new PdfConversionError(
              `LibreOffice exited with code ${code}. stderr: ${stderr.trim()}`,
            ),
          );
        }
      });
    });
  }
}
