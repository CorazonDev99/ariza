import type { PrismaClient, Profile } from '@prisma/client';
import type { ProfileData } from '../templates/applicant-fields';

export class ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  get(userId: number): Promise<Profile | null> {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  /** Full replace of the profile (used by the manual "Мои данные" form). */
  save(userId: number, data: ProfileData): Promise<Profile> {
    const fields = {
      fullName: data.fullName?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
    };
    return this.prisma.profile.upsert({
      where: { userId },
      update: fields,
      create: { userId, ...fields },
    });
  }

  /**
   * Merge non-empty values into the profile, keeping existing data for
   * keys that aren't provided. Used to auto-save the applicant's identity
   * after a document is generated, without wiping anything they'd typed.
   */
  async merge(userId: number, data: ProfileData): Promise<void> {
    const patch: Record<string, string> = {};
    if (data.fullName?.trim()) patch.fullName = data.fullName.trim();
    if (data.address?.trim()) patch.address = data.address.trim();
    if (data.phone?.trim()) patch.phone = data.phone.trim();
    if (Object.keys(patch).length === 0) return;
    await this.prisma.profile.upsert({
      where: { userId },
      update: patch,
      create: { userId, ...patch },
    });
  }
}
