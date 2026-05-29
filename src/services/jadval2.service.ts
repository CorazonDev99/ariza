/**
 * Client for jadval2.sud.uz case-schedule JSON endpoints.
 *
 * Each court type uses a slightly different backend, with different
 * field names. We normalize everything into a single `CaseEntry`
 * shape so the bot's renderer doesn't need to care.
 *
 * Endpoints (discovered by reading the page's getData()):
 *   fuqarolik  → https://jadvalapi.sud.uz/vka/CIVIL/{globalId}/{DDMMYYYY}
 *   iqtisodiy  → https://jadvalapi.sud.uz/vka/ECONOMIC/{globalId}/{DDMMYYYY}
 *   mamuriy    → https://jadvalapi.sud.uz/vka/CONFLICT/{globalId}/{DDMMYYYY}
 *   jinoyat    → https://api4.sud.uz/{globalId}/{DDMMYYYY}
 *
 * `globalId` is the button id from the district picker, e.g. `andvilfsud`
 * for civil/economic/administrative, or just a number like `2` for jinoyat.
 * We store it as the suffix of DistrictCourtDef.code (`{prefix}-{region}-{id}`)
 * and extract it on demand via extractGlobalId().
 */

/** Normalized hearing entry across all 4 court types. */
export interface CaseEntry {
  caseNumber: string;
  time: string;
  category?: string;
  /** First party shown in the table.
   *  - civil/economic: claimant (даъвогар)
   *  - jinoyat: defendant (судланувчи / accused)
   *  - administrative: subject of the action */
  party1: string;
  /** Second party.
   *  - civil/economic: defendant (жавобгар)
   *  - jinoyat: victim/prosecutor (жабрланувчи) */
  party2: string;
  judge: string;
  instance: string;
}

/** Civil / economic / administrative response shape (`/vka/...`). */
interface RawCivilLike {
  casenumber?: string;
  hearing_date?: string;
  hearing_time?: string;
  responsible?: string;
  instance?: string;
  category?: string;
  claiment?: string;
  defendant?: string;
}

/** Criminal response shape (api4.sud.uz). */
interface RawCriminal {
  casenumber?: string;
  hearing_date?: string;
  hearingtime?: string;
  judge?: string;
  instance?: string;
  defendant?: string;
  claimant?: string;
}

const VKA_BASE = 'https://jadvalapi.sud.uz/vka';

/** Strip the `{prefix}-{region}-` portion to recover the jadval2 button id. */
export function extractGlobalId(courtCode: string): string {
  const parts = courtCode.split('-');
  return parts.slice(2).join('-');
}

/** Format Date → `DDMMYYYY` (no separators, what the API expects). */
export function formatDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear());
  return `${dd}${mm}${yy}`;
}

/** Human-readable `DD.MM.YYYY` for the message header. */
export function formatHumanDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear());
  return `${dd}.${mm}.${yy}`;
}

function buildUrl(typeCode: string, globalId: string, dateStr: string): string {
  switch (typeCode) {
    case 'fuqarolik':
      return `${VKA_BASE}/CIVIL/${globalId}/${dateStr}`;
    case 'iqtisodiy':
      return `${VKA_BASE}/ECONOMIC/${globalId}/${dateStr}`;
    case 'mamuriy':
      return `${VKA_BASE}/CONFLICT/${globalId}/${dateStr}`;
    case 'jinoyat':
      return `https://api4.sud.uz/${globalId}/${dateStr}`;
    default:
      throw new Error(`Unknown court type: ${typeCode}`);
  }
}

/** Strip empty-paren BR markers (`<BR>(  )`), drop literal HTML break
 *  tags, and collapse whitespace. The jib endpoint returns multi-line
 *  defendant lists separated by `<BR>`; Telegram HTML doesn't understand
 *  `<br>`, so we substitute newlines. */
function cleanText(s: string | undefined): string | undefined {
  if (!s) return undefined;
  if (/<BR>\s*\(\s*\)/i.test(s) && s.replace(/<BR>\s*\(\s*\)/gi, '').trim() === '') {
    return undefined;
  }
  const cleaned = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
  return cleaned || undefined;
}

function normalizeCivilLike(raw: unknown): CaseEntry {
  const r = (raw ?? {}) as RawCivilLike;
  return {
    caseNumber: cleanText(r.casenumber) || '—',
    time: r.hearing_time?.trim() || '—',
    category: cleanText(r.category),
    party1: cleanText(r.claiment) || '—',
    party2: cleanText(r.defendant) || '—',
    judge: cleanText(r.responsible) || '—',
    instance: cleanText(r.instance) || '—',
  };
}

function normalizeCriminal(raw: unknown): CaseEntry {
  const r = (raw ?? {}) as RawCriminal;
  return {
    caseNumber: cleanText(r.casenumber) || '—',
    time: r.hearingtime?.trim() || '—',
    party1: cleanText(r.defendant) || '—',
    party2: cleanText(r.claimant) || '—',
    judge: cleanText(r.judge) || '—',
    instance: cleanText(r.instance) || '—',
  };
}

/** Fetch + normalize all hearings for one court on one date. Throws on
 *  network / HTTP errors; the caller renders a localized error message. */
export async function fetchSchedule(
  courtTypeCode: string,
  globalId: string,
  date: Date,
): Promise<CaseEntry[]> {
  const dateStr = formatDDMMYYYY(date);
  const url = buildUrl(courtTypeCode, globalId, dateStr);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'raport-bot (ariza)' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const entries =
    courtTypeCode === 'jinoyat'
      ? data.map(normalizeCriminal)
      : data.map(normalizeCivilLike);

  // Sort by time so the user sees morning hearings first.
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}
