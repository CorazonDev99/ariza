/**
 * Build `src/templates/court-info.generated.ts` from the OCR'd MySud
 * screenshots in `info sud/_merged.json`.
 *
 * Each screenshot card carries: title (court name, Cyrillic), sud_turi,
 * address, phone, email. We match the title to a court in the existing
 * registry (`district-courts.generated.ts`) so we inherit the canonical
 * `code`, `regionCode`, `courtTypeCode` and the localized name — then
 * attach the contact details (address / phone / email) from the card.
 *
 * Run: npx tsx scripts/build-court-info.ts          (writes the file)
 *      npx tsx scripts/build-court-info.ts --report (dry-run, prints stats)
 */
import fs from 'node:fs';
import path from 'node:path';
import { JADVAL2_COURTS } from '../src/templates/district-courts.generated';
import type { DistrictCourtDef } from '../src/templates/district-courts';

interface Card {
  file: string;
  kind: 'card' | 'list';
  title: string;
  sud_turi: string;
  address: string;
  phone: string;
  email: string;
}

const REPORT = process.argv.includes('--report');

/** Aggressively normalize a Cyrillic court name to a comparable core
 *  token. Strips the "<Type> ишлари бўйича" prefix, the embedded type
 *  words, the trailing "суди/суд", and folds Cyrillic letter variants so
 *  OCR/spelling differences still match. Keeps туман/шаҳар/вилоят/
 *  туманлараро which DISTINGUISH same-named courts. */
function norm(name: string): string {
  let s = name.toLowerCase();
  // strip apostrophe variants
  s = s.replace(/[‘’'`ʻ]/g, '');
  // remove the "... ишлари бўйича" prefix and lone type words
  s = s.replace(/фу[қк]аролик|жиноят|и[қк]тисоди[йи]|маъмури[йи]/g, ' ');
  s = s.replace(/ишлари|ишлар|б[ўу]йича/g, ' ');
  // remove trailing court word (handles the "судии" OCR/registry typo too)
  s = s.replace(/суд[иі]*/g, ' ');
  // fold Cyrillic letter variants
  s = s
    .replace(/ў/g, 'у')
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ҳ/g, 'х')
    .replace(/ё/g, 'е')
    .replace(/[ъь]/g, '');
  // fold structural court-level words so "вилояти"≈"вилоят" and
  // "туманлараро"≈"тумани"≈"туман" (cards vs registry differ on these).
  s = s
    .replace(/вилояти/g, 'вилоят')
    .replace(/туманлараро/g, 'туман')
    .replace(/тумани/g, 'туман')
    .replace(/шахри/g, 'шахар');
  // collapse to alnum tokens
  s = s.replace(/[^a-zа-я0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return s;
}

function mapType(sudTuri: string): string | null {
  const s = sudTuri.toLowerCase();
  if (s.includes('fuqarolik')) return 'fuqarolik';
  if (s.includes('jinoyat')) return 'jinoyat';
  if (s.includes('iqtisodiy') || s.includes('iqtisod')) return 'iqtisodiy';
  if (s.includes("ma'muriy") || s.includes('muriy') || s.includes('mamuriy'))
    return 'mamuriy';
  return null;
}

// Build registry lookup: type -> Map(normCore -> court[]).
const regByType = new Map<string, Map<string, DistrictCourtDef[]>>();
for (const c of JADVAL2_COURTS) {
  const m = regByType.get(c.courtTypeCode) ?? new Map();
  const key = norm(c.name.uz_cyrillic);
  const arr = m.get(key) ?? [];
  arr.push(c);
  m.set(key, arr);
  regByType.set(c.courtTypeCode, m);
}

const merged: Card[] = JSON.parse(
  fs.readFileSync(path.resolve('info sud/_merged.json'), 'utf8'),
);
const cards = merged.filter((c) => c.kind === 'card' && c.title?.trim());

interface InfoRow {
  code: string;
  regionCode: string;
  courtTypeCode: string;
  name: DistrictCourtDef['name'];
  address: string;
  phone: string;
  email: string;
}

const byCode = new Map<string, InfoRow>();
const unmatched: { title: string; type: string | null; file: string }[] = [];
const ambiguous: string[] = [];

function score(r: { address: string; phone: string; email: string }): number {
  return (r.address ? 1 : 0) + (r.phone ? 1 : 0) + (r.email ? 1 : 0);
}

for (const card of cards) {
  const type = mapType(card.sud_turi);
  if (!type) {
    unmatched.push({ title: card.title, type, file: card.file });
    continue;
  }
  const m = regByType.get(type);
  const hit = m?.get(norm(card.title));
  if (!hit || hit.length === 0) {
    unmatched.push({ title: card.title, type, file: card.file });
    continue;
  }
  if (hit.length > 1) ambiguous.push(`${card.title} -> ${hit.map((h) => h.code).join('|')}`);
  const court = hit[0]!;
  const row: InfoRow = {
    code: court.code,
    regionCode: court.regionCode,
    courtTypeCode: court.courtTypeCode,
    name: court.name,
    address: card.address.trim(),
    phone: card.phone.trim(),
    email: card.email.trim().toLowerCase(),
  };
  // Keep the most complete card if duplicates map to the same court.
  const prev = byCode.get(court.code);
  if (!prev || score(row) > score(prev)) byCode.set(court.code, row);
}

const rows = [...byCode.values()].sort((a, b) =>
  a.regionCode === b.regionCode
    ? a.courtTypeCode.localeCompare(b.courtTypeCode) ||
      a.name.uz_cyrillic.localeCompare(b.name.uz_cyrillic)
    : a.regionCode.localeCompare(b.regionCode),
);

// ---- report ----
const matchedByType: Record<string, number> = {};
for (const r of rows) matchedByType[r.courtTypeCode] = (matchedByType[r.courtTypeCode] || 0) + 1;
console.log(`cards: ${cards.length} | matched unique courts: ${rows.length}`);
console.log('matched by type:', JSON.stringify(matchedByType));
console.log(`unmatched: ${unmatched.length}`);
if (unmatched.length) {
  console.log('--- UNMATCHED ---');
  for (const u of unmatched) console.log(`  [${u.type}] ${u.title}  (${u.file})`);
}
if (ambiguous.length) {
  console.log('--- AMBIGUOUS (took first) ---');
  for (const a of ambiguous) console.log('  ' + a);
}

if (REPORT) process.exit(0);

// ---- emit generated file ----
const header = `// AUTO-GENERATED by scripts/build-court-info.ts — DO NOT EDIT BY HAND.
// Source: MySud app screenshots OCR'd into "info sud/". Each entry is a
// registry court (matched by name) plus its contact details (address /
// phone / email) as shown in the official MySud court directory.
import type { Locale } from '../i18n';

export interface CourtInfo {
  /** Matches a court \`code\` in district-courts.generated.ts. */
  code: string;
  regionCode: string;
  courtTypeCode: string;
  name: Record<Locale, string>;
  address: string;
  phone: string;
  email: string;
}

export const COURT_INFO: CourtInfo[] = ${JSON.stringify(rows, null, 2)};
`;

const out = path.resolve('src/templates/court-info.generated.ts');
fs.writeFileSync(out, header);
console.log(`\n✓ wrote ${out} (${rows.length} courts)`);
