/**
 * Render assets/avatar.svg → assets/avatar.png at 640×640.
 *
 * Usage:
 *   npm run avatar
 *
 * After re-running, open @BotFather → /mybots → ArizaPro → Edit Bot
 * → Edit Botpic → upload assets/avatar.png.
 */
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';

async function main(): Promise<void> {
  const inputPath = path.resolve('assets/avatar.svg');
  const outputPath = path.resolve('assets/avatar.png');

  const svg = await fs.readFile(inputPath);
  const buf = await sharp(svg, { density: 300 })
    .resize(640, 640, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(outputPath, buf);
  // eslint-disable-next-line no-console
  console.log(`✓ Wrote ${outputPath} (${buf.length} bytes)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
