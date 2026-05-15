import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function safeFileName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}_\-]+/gu, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'file';
}

export function withExt(filePath: string, ext: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.${ext.replace(/^\./, '')}`);
}
