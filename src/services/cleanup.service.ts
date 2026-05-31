import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger';

/**
 * Periodically deletes old files from the generated-documents directory so
 * the server disk doesn't fill up. Each document is already delivered to
 * the user in chat; the on-disk copy only backs the temporary QR /
 * `/download/<token>` link, which returns HTTP 410 gracefully once the
 * file is gone (see bot/webhook.ts).
 *
 * Files are removed by modification time. Returns a stop() function.
 * A retention of 0 (or less) disables cleanup entirely.
 */
export function startGeneratedCleanup(opts: {
  dir: string;
  retentionMs: number;
  intervalMs?: number;
}): () => void {
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000; // hourly

  if (opts.retentionMs <= 0) {
    logger.info('Generated-file cleanup disabled (retention <= 0)');
    return () => {};
  }

  const sweep = async (): Promise<void> => {
    const now = Date.now();
    let removed = 0;
    let bytes = 0;
    let names: string[];
    try {
      names = await fs.readdir(opts.dir);
    } catch (err) {
      logger.warn({ err, dir: opts.dir }, 'cleanup: cannot read dir');
      return;
    }
    for (const name of names) {
      const fp = path.join(opts.dir, name);
      try {
        const st = await fs.stat(fp);
        if (!st.isFile()) continue;
        if (now - st.mtimeMs > opts.retentionMs) {
          bytes += st.size;
          await fs.unlink(fp);
          removed += 1;
        }
      } catch {
        /* file vanished mid-sweep / permission — ignore */
      }
    }
    if (removed > 0) {
      logger.info(
        { removed, freedMb: +(bytes / 1_048_576).toFixed(1), dir: opts.dir },
        'Cleaned up old generated files',
      );
    }
  };

  void sweep(); // run once at startup
  const timer = setInterval(() => void sweep(), intervalMs);
  // Don't keep the event loop alive solely for the cleanup timer.
  (timer as { unref?: () => void }).unref?.();

  logger.info(
    { dir: opts.dir, retentionHours: +(opts.retentionMs / 3_600_000).toFixed(1) },
    'Generated-file cleanup scheduled',
  );
  return () => clearInterval(timer);
}
