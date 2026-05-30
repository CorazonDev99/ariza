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

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 500;
interface CacheEntry {
  entries: CaseEntry[];
  expiresAt: number;
}
const CACHE = new Map<string, CacheEntry>();

/** Test/admin hook — drops every cached schedule. */
export function clearScheduleCache(): void {
  CACHE.clear();
}

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

/**
 * URLs to fetch for a single (type, court, date) lookup. The first
 * URL is the primary — if it fails, the user gets an error. The rest
 * are backups: failures are swallowed and merged in best-effort, just
 * like jadval2.sud.uz's own page does for fib/is.
 */
function buildUrls(typeCode: string, globalId: string, dateStr: string): string[] {
  switch (typeCode) {
    case 'fuqarolik':
      return [
        `${VKA_BASE}/CIVIL/${globalId}/${dateStr}`,
        `https://api2.sud.uz/${globalId}/${dateStr}`,
      ];
    case 'iqtisodiy':
      return [
        `${VKA_BASE}/ECONOMIC/${globalId}/${dateStr}`,
        `https://api3.sud.uz/${globalId}/${dateStr}`,
      ];
    case 'mamuriy':
      return [`${VKA_BASE}/CONFLICT/${globalId}/${dateStr}`];
    case 'jinoyat':
      return [`https://api4.sud.uz/${globalId}/${dateStr}`];
    case 'mhb':
      // Маъмурий ҳуқуқбузарликлар (jib/mhb) — heard by the criminal
      // courts, served by api5 with the criminal response shape.
      return [`https://api5.sud.uz/${globalId}/${dateStr}`];
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

/** Per-request timeout — backups are best-effort, primary gets a longer
 *  budget so users get real data when the main API is just slow. */
const PRIMARY_TIMEOUT_MS = 10_000;
const BACKUP_TIMEOUT_MS = 4_000;

async function fetchJsonArray(url: string, timeoutMs: number): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'raport-bot (ariza)' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch + normalize all hearings for one court on one date. Throws on
 * primary-endpoint network / HTTP errors so the caller can render a
 * localized error. Backup-endpoint failures are silent.
 *
 * Results are cached for {@link CACHE_TTL_MS} per (type, court, date)
 * key — useful when a viral message in a chat sends many users to look
 * up the same hearing list.
 */
export async function fetchSchedule(
  courtTypeCode: string,
  globalId: string,
  date: Date,
): Promise<CaseEntry[]> {
  const dateStr = formatDDMMYYYY(date);
  const cacheKey = `${courtTypeCode}|${globalId}|${dateStr}`;

  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  const urls = buildUrls(courtTypeCode, globalId, dateStr);
  const normalize =
    courtTypeCode === 'jinoyat' || courtTypeCode === 'mhb'
      ? normalizeCriminal
      : normalizeCivilLike;

  // Primary failure → user-visible error. We deliberately don't fall
  // back to backups for the primary error case — backups exist for
  // *additional* coverage (mainline sometimes drops courts), not as
  // a replacement when the main API is down.
  const primaryPromise = fetchJsonArray(urls[0]!, PRIMARY_TIMEOUT_MS);

  // Backups run IN PARALLEL with primary (not after) — was previously
  // sequential which doubled wall-clock latency when both endpoints were
  // slow. Each backup has its own 4s ceiling so a hanging api2/api3
  // can't keep the user waiting past the primary's response.
  const backupPromises =
    urls.length > 1
      ? urls.slice(1).map((u) =>
          fetchJsonArray(u, BACKUP_TIMEOUT_MS).then((d) => d.map(normalize)),
        )
      : [];

  const primaryData = await primaryPromise;
  const primaryEntries = primaryData.map(normalize);

  const backupEntries: CaseEntry[] = [];
  if (backupPromises.length > 0) {
    const results = await Promise.allSettled(backupPromises);
    for (const r of results) {
      if (r.status === 'fulfilled') backupEntries.push(...r.value);
    }
  }

  // Dedup by (case number, time) — primary + backup occasionally return
  // the same hearing. Primary wins (it appears first in the merged list).
  const seen = new Set<string>();
  const merged: CaseEntry[] = [];
  for (const e of [...primaryEntries, ...backupEntries]) {
    const key = `${e.caseNumber}|${e.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }
  merged.sort((a, b) => a.time.localeCompare(b.time));

  // Drop oldest 20% if cache is full — simple LRU-ish eviction.
  if (CACHE.size >= CACHE_MAX_SIZE) {
    const drop = Math.ceil(CACHE_MAX_SIZE * 0.2);
    let i = 0;
    for (const k of CACHE.keys()) {
      if (i++ >= drop) break;
      CACHE.delete(k);
    }
  }
  CACHE.set(cacheKey, {
    entries: merged,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return merged;
}

/** Case-insensitive substring match against the visible fields. */
export function searchEntries(entries: CaseEntry[], query: string): CaseEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    [e.party1, e.party2, e.caseNumber, e.judge, e.category]
      .filter((s): s is string => !!s)
      .some((field) => field.toLowerCase().includes(q)),
  );
}
