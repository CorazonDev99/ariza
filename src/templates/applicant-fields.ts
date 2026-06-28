/**
 * «Мои данные» (saved profile) ↔ ariza field mapping.
 *
 * The applicant (the user filling the form) always appears as the
 * plaintiff / collector / first-spouse side of a template, so their
 * identity fields use these specific keys. The other party
 * (defendant / debtor / …) is intentionally NOT here.
 */
export type ProfileKey = 'fullName' | 'address' | 'phone';

export interface ProfileData {
  fullName?: string | null;
  address?: string | null;
  phone?: string | null;
}

/** profile key → set of ariza field keys that hold the applicant's value. */
export const APPLICANT_FIELD_KEYS: Record<ProfileKey, readonly string[]> = {
  fullName: ['plaintiff_fio', 'collector_fio', 'first_spouse_fio'],
  address: ['plaintiff_address', 'collector_address'],
  phone: ['plaintiff_phone', 'collector_phone'],
};

/** Reverse lookup: ariza field key → profile key (or null). */
export function profileKeyForField(fieldKey: string): ProfileKey | null {
  for (const pk of Object.keys(APPLICANT_FIELD_KEYS) as ProfileKey[]) {
    if (APPLICANT_FIELD_KEYS[pk].includes(fieldKey)) return pk;
  }
  return null;
}

/**
 * Pull the applicant's identity out of a completed values map, so it can
 * be saved to the profile after a document is generated. Returns only the
 * keys that have a non-empty value.
 */
export function extractProfileFromValues(
  values: Record<string, string>,
): ProfileData {
  const out: ProfileData = {};
  for (const pk of Object.keys(APPLICANT_FIELD_KEYS) as ProfileKey[]) {
    for (const fk of APPLICANT_FIELD_KEYS[pk]) {
      const v = values[fk]?.trim();
      if (v) {
        out[pk] = v;
        break;
      }
    }
  }
  return out;
}

/** True when the profile holds at least one usable value. */
export function profileHasData(p: ProfileData | null | undefined): boolean {
  return Boolean(p && (p.fullName || p.address || p.phone));
}
