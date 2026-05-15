import type { PrismaClient, User } from '@prisma/client';
import type { Locale } from '../i18n';

export interface UpsertUserInput {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertUserInput): Promise<User> {
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(input.telegramId) },
      update: {
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null,
      },
      create: {
        telegramId: BigInt(input.telegramId),
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null,
      },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByTelegramId(telegramId: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  setLanguage(id: number, language: Locale): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { language },
    });
  }
}
