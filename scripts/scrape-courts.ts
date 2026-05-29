/**
 * Scrape the official jadval2.sud.uz site for the authoritative court
 * registry across all 4 court types (fib/jib/mib/is) × 14 regions.
 *
 * Run: `npx tsx scripts/scrape-courts.ts`
 *
 * Output: src/templates/district-courts.generated.ts — a TS module
 * exporting JADVAL2_COURTS: DistrictCourtDef[]. The bot consumes this
 * via src/templates/district-courts.ts (which attaches MySud addresses
 * by region+name fuzzy match where possible).
 *
 * Re-run any time to refresh data. Commit the resulting diff.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cyrillicToLatin } from '../src/i18n/transliterate';

const BASE = 'https://jadval2.sud.uz';

/**
 * Each court type has a different URL prefix on jadval2:
 *   fib/regions.html   — fuqarolik (civil)
 *   jib/jib/regions.html — jinoyat (criminal). The bare /jib/ path is an
 *     intermediate "court types" page with two subtypes (jinoyat /
 *     m'amuriy huquqbuzarlik); we follow the jinoyat branch only.
 *   mib/regions.html   — mamuriy (administrative)
 *   is/regions.html    — iqtisodiy (economic)
 */
const COURT_TYPES = [
  { basePath: 'fib', code: 'fuqarolik', prefix: 'fuq' },
  { basePath: 'jib/jib', code: 'jinoyat', prefix: 'jin' },
  { basePath: 'mib', code: 'mamuriy', prefix: 'mam' },
  { basePath: 'is', code: 'iqtisodiy', prefix: 'iqt' },
] as const;

/** jadval2 region URL slug (lowercased basename of {slug}-dis.html) → bot region code. */
const REGION_SLUG_MAP: Record<string, string> = {
  andijon: 'andijan',
  buxoro: 'bukhara',
  jizzax: 'jizzakh',
  qashqadaryo: 'kashkadarya',
  qoraqalpogiston: 'karakalpakstan',
  qoraqalpoq: 'karakalpakstan',
  qarqalpogiston: 'karakalpakstan',
  navoiy: 'navoi',
  navoi: 'navoi',
  namangan: 'namangan',
  samarqand: 'samarkand',
  sirdaryo: 'syrdarya',
  surxondaryo: 'surkhandarya',
  'toshkent-vil': 'tashkent_region',
  toshkentvil: 'tashkent_region',
  'toshkent-sh': 'tashkent_city',
  toshkentsh: 'tashkent_city',
  toshkent: 'tashkent_city',
  fargona: 'fergana',
  'fargʻona': 'fergana',
  xorazm: 'khorezm',
};

interface ScrapedCourt {
  code: string;
  regionCode: string;
  courtTypeCode: string;
  nameCY: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retry transient 5xx errors with linear backoff (cdn cold-starts return 503). */
async function fetchText(url: string, attempt = 1): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (raport-bot court-scraper; +https://github.com)',
    },
  });
  if (res.status >= 500 && res.status < 600 && attempt < 5) {
    const delay = 500 * attempt;
    console.warn(`  ! ${res.status} for ${url} — retry ${attempt} in ${delay}ms`);
    await sleep(delay);
    return fetchText(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}

/** Extract `{slug}` from every `<form action="{slug}-dis.html">` in the regions page. */
function parseRegionSlugs(html: string): string[] {
  const re = /<form\s+action\s*=\s*["']([^"']+?)-dis\.html["']/gi;
  const slugs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) slugs.push(m[1]!.trim());
  return [...new Set(slugs)];
}

/** Extract every `<button id="..." value="...">` court entry from a district page. */
function parseCourtButtons(html: string): { id: string; name: string }[] {
  const re =
    /<button\b[^>]*?\bid\s*=\s*["']([^"']+)["'][^>]*?\bvalue\s*=\s*["']([^"']+)["']/gi;
  const out: { id: string; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ id: m[1]!.trim(), name: m[2]!.trim() });
  }
  return out;
}

async function scrapeType(
  basePath: string,
  typeCode: string,
  prefix: string,
): Promise<ScrapedCourt[]> {
  const regionsHtml = await fetchText(`${BASE}/${basePath}/regions.html`);
  const slugs = parseRegionSlugs(regionsHtml);
  console.log(`  [${basePath}] regions: ${slugs.length} → ${slugs.join(', ')}`);

  const courts: ScrapedCourt[] = [];
  for (const slug of slugs) {
    const regionCode = REGION_SLUG_MAP[slug.toLowerCase()];
    if (!regionCode) {
      console.warn(`  [${basePath}]   ! unknown region slug: ${slug}`);
      continue;
    }
    await sleep(150);
    const html = await fetchText(`${BASE}/${basePath}/${slug}-dis.html`);
    const buttons = parseCourtButtons(html);
    for (const b of buttons) {
      courts.push({
        code: `${prefix}-${regionCode}-${b.id}`,
        regionCode,
        courtTypeCode: typeCode,
        nameCY: b.name,
      });
    }
    console.log(`  [${basePath}]   ${slug} (${regionCode}): ${buttons.length} courts`);
  }
  return courts;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatCourt(c: ScrapedCourt): string {
  const la = cyrillicToLatin(c.nameCY);
  return [
    '  {',
    `    code: '${esc(c.code)}',`,
    `    regionCode: '${esc(c.regionCode)}',`,
    `    courtTypeCode: '${esc(c.courtTypeCode)}',`,
    '    name: {',
    `      uz_cyrillic: '${esc(c.nameCY)}',`,
    `      uz_latin: '${esc(la)}',`,
    `      ru: '${esc(c.nameCY)}',`,
    '    },',
    '  },',
  ].join('\n');
}

async function main() {
  console.log('Scraping jadval2.sud.uz …');
  const all: ScrapedCourt[] = [];
  for (const t of COURT_TYPES) {
    console.log(`[${t.code}]`);
    const courts = await scrapeType(t.basePath, t.code, t.prefix);
    all.push(...courts);
    console.log(`  → ${courts.length} ${t.code} courts`);
  }

  console.log(`\nTotal: ${all.length} courts across ${COURT_TYPES.length} types`);

  const body = [
    '/* eslint-disable */',
    '// AUTO-GENERATED by scripts/scrape-courts.ts — do not edit by hand.',
    `// Source: ${BASE}/{fib,jib,mib,is}/regions.html`,
    `// Counts: ${COURT_TYPES.map((t) => {
      const n = all.filter((c) => c.courtTypeCode === t.code).length;
      return `${t.code}=${n}`;
    }).join(', ')}`,
    '',
    "import type { DistrictCourtDef } from './district-courts';",
    '',
    'export const JADVAL2_COURTS: DistrictCourtDef[] = [',
    all.map(formatCourt).join('\n'),
    '];',
    '',
  ].join('\n');

  const outPath = resolve(
    __dirname,
    '..',
    'src',
    'templates',
    'district-courts.generated.ts',
  );
  writeFileSync(outPath, body, 'utf-8');
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
