import { config } from './config';
import { logger } from './utils/logger';
import { ensureDir } from './utils/fs';
import { createBot } from './bot';
import { disconnectPrisma, prisma } from './repositories/prisma';
import { SeedService } from './services/seed.service';
import { TemplateRepository } from './repositories/template.repository';
import { DocumentRepository } from './repositories/document.repository';
import { startHttpServer } from './bot/webhook';
import { LOCALES, t, isLocale, type Locale } from './i18n';
import type { Telegraf } from 'telegraf';
import type { BotContext } from './bot/context';
import type { UserRepository } from './repositories/user.repository';

async function main(): Promise<void> {
  logger.info({ env: config.nodeEnv }, 'Starting raport-bot');

  await ensureDir(config.outputDir);
  await ensureDir(config.templatesDir);

  await prisma.$queryRaw`SELECT 1`;
  await new SeedService(new TemplateRepository(prisma)).run();

  const documentRepo = new DocumentRepository(prisma);
  const { bot, paymentService, userRepo } = createBot();

  startHttpServer(paymentService, documentRepo, async (userId, status) => {
    if (status !== 'paid') return;
    const u = await userRepo.findById(userId);
    if (!u) return;
    const raw = (u as unknown as { language?: string }).language;
    const locale: Locale = isLocale(raw) ? raw : 'uz_cyrillic';
    try {
      // Async payment confirmation (e.g. Click webhook) — just tell the user
      // their payment was accepted. The actual PDF is generated when they
      // press the "check payment" button in the chat, which triggers
      // `pay:check` in the wizard scene and runs generateAndSend with format
      // forced to PDF.
      await bot.telegram.sendMessage(
        u.telegramId.toString(),
        t(locale, 'pay.success'),
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      logger.error({ e, userId }, 'Cannot deliver payment success message');
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.warn({ signal }, 'Shutting down');
    bot.stop(signal);
    await disconnectPrisma();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  bot.launch().catch((err) => {
    logger.fatal({ err }, 'Telegraf launch failed');
    process.exit(1);
  });
  logger.info('Bot started (long polling)');

  // Register the / menu commands per locale (best-effort; failures don't crash).
  void registerBotCommands(bot, userRepo).catch((err) =>
    logger.warn({ err }, 'setMyCommands failed'),
  );
  // Push the bot's display name + descriptions to Telegram. Idempotent —
  // values are overwritten each startup with whatever is in i18n + env.
  void registerBotProfile(bot).catch((err) =>
    logger.warn({ err }, 'registerBotProfile failed'),
  );
}

/**
 * Sets the per-locale "/" menu in the Telegram client.
 *
 * Telegram lets us register a separate command list per `language_code` —
 * we map our bot locales to BCP-47 codes Telegram understands:
 *   uz_cyrillic / uz_latin → 'uz'
 *   ru                     → 'ru'
 * The Cyrillic list also goes to the default scope (no language_code)
 * so users with exotic Telegram UI languages still see something useful.
 *
 * Admins additionally get /admin and /broadcast via `BotCommandScopeChat`,
 * which takes precedence over the language-scoped list for their chat.
 */
async function registerBotCommands(
  bot: Telegraf<BotContext>,
  users: UserRepository,
): Promise<void> {
  const baseCmd = (locale: Locale) => [
    { command: 'new', description: t(locale, 'cmd.new.desc') },
    { command: 'jadval', description: t(locale, 'jadval.cmd.desc') },
    { command: 'guide', description: t(locale, 'cmd.guide.desc') },
    { command: 'lang', description: t(locale, 'cmd.lang.desc') },
    { command: 'about', description: t(locale, 'cmd.about.desc') },
    { command: 'cancel', description: t(locale, 'cmd.cancel.desc') },
    { command: 'start', description: t(locale, 'cmd.start.desc') },
  ];

  const adminCmd = (locale: Locale) => [
    ...baseCmd(locale),
    { command: 'admin', description: t(locale, 'cmd.admin.desc') },
    { command: 'broadcast', description: t(locale, 'cmd.broadcast.desc') },
  ];

  // Default scope (no language_code): use Cyrillic.
  await bot.telegram.setMyCommands(baseCmd('uz_cyrillic'));

  // Per-language lists. uz_cyrillic and uz_latin both collide on 'uz' —
  // Cyrillic wins (it's what most Uzbek Telegram users have).
  for (const locale of LOCALES) {
    if (locale === 'uz_latin') continue;
    const lang = locale === 'ru' ? 'ru' : 'uz';
    await bot.telegram.setMyCommands(baseCmd(locale), { language_code: lang });
  }

  // Admin-scoped commands (per-chat overrides). We look up each admin's
  // stored locale; if they've never started the bot we fall back to ru.
  for (const adminTgId of config.adminChatIds) {
    try {
      const u = await users.findByTelegramId(adminTgId);
      const raw = (u as unknown as { language?: string } | null)?.language;
      const locale: Locale = isLocale(raw) ? raw : 'ru';
      await bot.telegram.setMyCommands(adminCmd(locale), {
        scope: { type: 'chat', chat_id: adminTgId },
      });
      logger.info({ adminTgId, locale }, 'Admin commands registered');
    } catch (e) {
      logger.warn({ e, adminTgId }, 'Failed to register admin commands');
    }
  }
}

/**
 * Pushes the bot's identity to Telegram on every startup:
 *   - setMyName             → display name (shown next to the bot)
 *   - setMyShortDescription → 1-line subtitle in the chat list
 *   - setMyDescription      → multi-line text shown above the START button
 *                              when a new user opens the bot for the first time
 *
 * All three are set per-language (uz, ru) plus a default fallback so users
 * with exotic Telegram UI languages still see something coherent.
 */
async function registerBotProfile(bot: Telegraf<BotContext>): Promise<void> {
  const name = config.botDisplayName;
  const amount = new Intl.NumberFormat('ru-RU').format(config.payment.amount);

  // (locale used for i18n strings, lang_code for the Telegram API).
  // uz_latin is intentionally omitted — Telegram has one "uz" slot only,
  // and Cyrillic is what most Uzbek-language Telegram clients show.
  const entries: Array<{ locale: Locale; lang_code?: string }> = [
    { locale: 'uz_cyrillic', lang_code: 'uz' },
    { locale: 'ru', lang_code: 'ru' },
    { locale: 'uz_cyrillic' }, // default scope — fallback for everything else
  ];

  for (const e of entries) {
    // Inline price line — "💳 18 000 …" when payments are enabled,
    // "🎁 Free for now" otherwise. Spliced into `bot.description` so
    // the Telegram profile reflects the current monetisation state.
    const priceLine = t(
      e.locale,
      config.payment.enabled ? 'bot.price_line.paid' : 'bot.price_line.free',
      { amount },
    );

    try {
      await bot.telegram.setMyName(name, e.lang_code);
    } catch (err) {
      logger.warn({ err, lang: e.lang_code }, 'setMyName failed');
    }
    try {
      await bot.telegram.setMyShortDescription(
        t(e.locale, 'bot.short_description', { amount }),
        e.lang_code,
      );
    } catch (err) {
      logger.warn({ err, lang: e.lang_code }, 'setMyShortDescription failed');
    }
    try {
      await bot.telegram.setMyDescription(
        t(e.locale, 'bot.description', { price_line: priceLine }),
        e.lang_code,
      );
    } catch (err) {
      logger.warn({ err, lang: e.lang_code }, 'setMyDescription failed');
    }
  }
  logger.info(
    { name, amount, paymentEnabled: config.payment.enabled },
    'Bot profile (name + descriptions) registered',
  );
}

main().catch(async (err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  await disconnectPrisma();
  process.exit(1);
});
