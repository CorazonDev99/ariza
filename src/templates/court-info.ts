import { COURT_INFO, type CourtInfo } from './court-info.generated';

/**
 * Court-directory lookups for the "ℹ️ Суд маълумоти" flow
 * (Region → Court type → Court → info card).
 *
 * Data comes from the official MySud app directory, OCR'd into
 * `court-info.generated.ts`. Only courts that actually have a contact
 * card are present — so the flow never offers a court with no info.
 */

export type { CourtInfo };

/** Region codes that have at least one court with info. */
export function getInfoRegionCodes(): Set<string> {
  return new Set(COURT_INFO.map((c) => c.regionCode));
}

/** Court-type codes that have any court with info, in display order.
 *  Flow step 1 (court type → region → court). */
const TYPE_ORDER = ['fuqarolik', 'jinoyat', 'mamuriy', 'iqtisodiy'];
export function getInfoTypeCodes(): string[] {
  const present = new Set(COURT_INFO.map((c) => c.courtTypeCode));
  return TYPE_ORDER.filter((t) => present.has(t));
}

/** Region codes that have courts of the given type with info. */
export function getInfoRegionsForType(courtTypeCode: string): Set<string> {
  return new Set(
    COURT_INFO.filter((c) => c.courtTypeCode === courtTypeCode).map(
      (c) => c.regionCode,
    ),
  );
}

/** Distinct court-type codes available within a region (in a stable
 *  order matching COURT_TYPES: fuqarolik, jinoyat, mamuriy, iqtisodiy). */
export function getInfoTypesForRegion(regionCode: string): string[] {
  const present = new Set(
    COURT_INFO.filter((c) => c.regionCode === regionCode).map(
      (c) => c.courtTypeCode,
    ),
  );
  return TYPE_ORDER.filter((t) => present.has(t));
}

/** Courts (with info) for a region + type, sorted with the regional
 *  ("вилоят") court first, then alphabetically by name. */
export function getInfoCourtsFor(
  regionCode: string,
  courtTypeCode: string,
): CourtInfo[] {
  return COURT_INFO.filter(
    (c) => c.regionCode === regionCode && c.courtTypeCode === courtTypeCode,
  ).sort((a, b) => {
    const av = /вилоят/i.test(a.name.uz_cyrillic) ? 0 : 1;
    const bv = /вилоят/i.test(b.name.uz_cyrillic) ? 0 : 1;
    return av !== bv
      ? av - bv
      : a.name.uz_cyrillic.localeCompare(b.name.uz_cyrillic);
  });
}

export function getCourtInfoByCode(code: string): CourtInfo | undefined {
  return COURT_INFO.find((c) => c.code === code);
}

/** Google Maps search link built from the court's legal address. */
export function buildMapLink(address: string): string {
  const q = encodeURIComponent(`${address}, Oʻzbekiston`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
