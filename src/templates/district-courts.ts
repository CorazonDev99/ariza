import type { Locale } from '../i18n';
import { JADVAL2_COURTS } from './district-courts.generated';

/**
 * District / interdistrict court within a region. After the user picks
 * one, its `name` is stored in `state.values.district_court_name` and
 * rendered into the document header.
 *
 * Data is auto-generated from the official jadval2.sud.uz site (the
 * Supreme Court's case-schedule portal — same registry used by judges).
 * Re-run `npx tsx scripts/scrape-courts.ts` to refresh; the diff lands
 * in `district-courts.generated.ts`.
 */
export interface DistrictCourtDef {
  code: string;
  regionCode: string;
  courtTypeCode: string;
  /** Short legal name used both for the picker button label AND written
   *  into the document as `district_court_name`. Templates may prepend
   *  type-prefixes like "Жиноят ишлари бўйича …" or "Фуқаролик ишлари
   *  бўйича …", so names here are kept SHORT (matching how jadval2
   *  lists them, without the "ishlari bo‘yicha" framing). */
  name: Record<Locale, string>;
  /** Optional physical address. jadval2 does not expose addresses, but
   *  the field is preserved so an address-overlay step can attach them
   *  later without changing the schema. */
  address?: Record<Locale, string>;
}

export const DISTRICT_COURTS: DistrictCourtDef[] = JADVAL2_COURTS;

export function getDistrictCourtByCode(code: string): DistrictCourtDef | undefined {
  return DISTRICT_COURTS.find((d) => d.code === code);
}

/** All district courts for a (courtType, region) pair, in declared order. */
export function getDistrictCourtsFor(
  courtTypeCode: string,
  regionCode: string,
): DistrictCourtDef[] {
  return DISTRICT_COURTS.filter(
    (d) => d.courtTypeCode === courtTypeCode && d.regionCode === regionCode,
  );
}
