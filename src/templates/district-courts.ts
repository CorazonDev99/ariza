import type { Locale } from '../i18n';
import { JADVAL2_COURTS } from './district-courts.generated';
import { MHB_COURTS } from './mhb-courts.generated';

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

/**
 * Synthesised IQTISODIY entries used by the ariza wizard ONLY. The
 * jadval2 scrape gives us 88 real iqtisodiy courts (several per region)
 * — useful for schedule lookup but wrong for the ariza picker, where the
 * user files at viloyat / tumanlararo level just like mamuriy (only 2
 * entries per region). We clone the mamuriy entries 1:1 — same display
 * names, same regional structure — but flip the `courtTypeCode` to
 * 'iqtisodiy' and re-prefix the codes so they're distinct from the
 * schedule-flow ones.
 *
 * The schedule flow (`getDistrictCourtsFor`) keeps using the original
 * 88 iqtisodiy courts so users can still drill down to their specific
 * court when looking up hearings on jadval2.sud.uz.
 */
const IQTISODIY_ARIZA_COURTS: DistrictCourtDef[] = JADVAL2_COURTS
  .filter((c) => c.courtTypeCode === 'mamuriy')
  .map((c) => ({
    ...c,
    code: c.code.replace(/^mam-/, 'iqt-ariza-'),
    courtTypeCode: 'iqtisodiy',
  }));

/**
 * All known court entries — real (from jadval2) + synthesised
 * (iqtisodiy ariza). Used by `getDistrictCourtByCode` so that lookups
 * by code work for both flow types.
 */
export const DISTRICT_COURTS: DistrictCourtDef[] = [
  ...JADVAL2_COURTS,
  ...IQTISODIY_ARIZA_COURTS,
  ...MHB_COURTS,
];

/** Pool searched by the SCHEDULE flow — real jadval2 courts plus the
 *  administrative-offences (`mhb`) courts (jib/mhb), which share the
 *  criminal courts but use a different schedule API (api5). */
const SCHEDULE_POOL: DistrictCourtDef[] = [...JADVAL2_COURTS, ...MHB_COURTS];

export function getDistrictCourtByCode(code: string): DistrictCourtDef | undefined {
  return DISTRICT_COURTS.find((d) => d.code === code);
}

/**
 * District courts for the SCHEDULE flow (📋 «Проверить дело»).
 *
 * Returns the FULL jadval2 list — including all 219 jinoyat district
 * courts — so users can find their specific local court when looking
 * up hearings.
 */
export function getDistrictCourtsFor(
  courtTypeCode: string,
  regionCode: string,
): DistrictCourtDef[] {
  return SCHEDULE_POOL.filter(
    (d) => d.courtTypeCode === courtTypeCode && d.regionCode === regionCode,
  );
}

/**
 * District courts for the ARIZA wizard (📄 «Подать заявление»).
 *
 * Same as the schedule list for fuqarolik / mamuriy / jinoyat, but
 * for iqtisodiy we return ONLY the 2-per-region synthesised pair
 * (viloyat sudi + tumanlararo sudi) — matching mamuriy's structure —
 * because economic arizas are filed at viloyat / tumanlararo level,
 * not at each individual district court.
 */
export function getArizaCourtsFor(
  courtTypeCode: string,
  regionCode: string,
): DistrictCourtDef[] {
  if (courtTypeCode === 'iqtisodiy') {
    return IQTISODIY_ARIZA_COURTS.filter((d) => d.regionCode === regionCode);
  }
  return JADVAL2_COURTS.filter(
    (d) => d.courtTypeCode === courtTypeCode && d.regionCode === regionCode,
  );
}
