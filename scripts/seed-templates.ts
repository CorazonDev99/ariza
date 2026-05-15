/**
 * Manually re-runs the template seeder (idempotent).
 * Also runs at every bot startup via SeedService — this script
 * is here for explicit CLI usage.
 *
 * Run: npm run template:seed
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { TEMPLATES } from '../src/templates/registry';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const t of TEMPLATES) {
    const filePath = path.resolve(
      './templates',
      `${t.fileNameBase}.uz_cyrillic.docx`,
    );
    const r = await prisma.template.upsert({
      where: { code: t.code },
      update: {
        category: t.category,
        title: t.title.uz_cyrillic,
        subtitle: t.subtitle.uz_cyrillic,
        description: t.description.uz_cyrillic,
        filePath,
        active: true,
      },
      create: {
        code: t.code,
        category: t.category,
        title: t.title.uz_cyrillic,
        subtitle: t.subtitle.uz_cyrillic,
        description: t.description.uz_cyrillic,
        filePath,
        active: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`✓ ${r.code} (#${r.id})`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
