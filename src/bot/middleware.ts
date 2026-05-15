import type { MiddlewareFn } from 'telegraf';
import type { UserRepository } from '../repositories/user.repository';
import { isLocale, type Locale } from '../i18n';
import { logger } from '../utils/logger';
import type { BotContext } from './context';

export function loggerMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const started = Date.now();
    const updateType = ctx.updateType;
    const from = ctx.from?.id;
    try {
      await next();
    } finally {
      logger.debug(
        { updateType, from, ms: Date.now() - started },
        'update handled',
      );
    }
  };
}

export function userMiddleware(
  users: UserRepository,
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (ctx.from) {
      ctx.dbUser = await users.upsert({
        telegramId: ctx.from.id,
        username: ctx.from.username ?? null,
        firstName: ctx.from.first_name ?? null,
        lastName: ctx.from.last_name ?? null,
        languageCode: ctx.from.language_code ?? null,
      });
      const raw = (ctx.dbUser as unknown as { language?: string }).language;
      ctx.locale = (isLocale(raw) ? raw : 'uz_cyrillic') as Locale;
    } else {
      ctx.locale = 'uz_cyrillic';
    }
    return next();
  };
}

export function errorBoundary(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      logger.error({ err }, 'Unhandled error in update handler');
      try {
        await ctx.reply('⚠️ Internal error. Please try /start again.');
      } catch {
        /* swallow */
      }
    }
  };
}
