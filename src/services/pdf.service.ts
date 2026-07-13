import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config } from '../config';
import { PdfConversionError } from '../utils/errors';
import { ensureDir, fileExists, withExt } from '../utils/fs';
import { logger } from '../utils/logger';

/** Hard cap on a single conversion so a wedged soffice can never hang the
 *  bot forever (a headless LibreOffice cold start is ~5–15s). */
const CONVERT_TIMEOUT_MS = 90_000;

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

    // A private, per-conversion user profile. Critical on servers:
    //   * ProtectHome=true (systemd) makes $HOME unreadable, so the default
    //     ~/.config/libreoffice profile can't be created → soffice hangs.
    //   * A stale lock left by a crashed soffice makes every later run hang.
    // Isolating the profile per run sidesteps both. Lives under the private
    // /tmp (PrivateTmp=true) and is removed afterwards.
    const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lo-profile-'));

    const args = [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--headless',
      '--norestore',
      '--nolockcheck',
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

    try {
      await this.runLibreOffice(args);
    } finally {
      await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {
        /* best-effort cleanup */
      });
    }

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
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done(() =>
          reject(
            new PdfConversionError(
              `LibreOffice timed out after ${CONVERT_TIMEOUT_MS}ms (killed)`,
            ),
          ),
        );
      }, CONVERT_TIMEOUT_MS);

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.stdout.on('data', (chunk) => {
        logger.debug({ out: chunk.toString().trim() }, 'soffice stdout');
      });

      child.on('error', (err) => {
        done(() =>
          reject(
            new PdfConversionError(
              `Failed to start LibreOffice (${config.libreofficeBin}): ${err.message}`,
              err,
            ),
          ),
        );
      });

      child.on('close', (code) => {
        done(() => {
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
    });
  }
}
