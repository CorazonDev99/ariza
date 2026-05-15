import type { Telegraf } from 'telegraf';
import { LOCALE_META, t, type Locale } from '../i18n';
import { config } from '../config';
import {
  aboutInline,
  detectMenuAction,
  instructionsDetailInline,
  instructionsListInline,
  languageInline,
  mainMenu,
} from './keyboards';
import { ARIZA_WIZARD_ID } from '../scenes';
import { TEMPLATES, getTemplateByCode } from '../templates/registry';
import type { BotContext } from './context';
import type { DocumentRepository } from '../repositories/document.repository';
import type { DraftRepository } from '../repositories/draft.repository';
import type { UserRepository } from '../repositories/user.repository';

export interface CommandDeps {
  documents: DocumentRepository;
  drafts: DraftRepository;
  users: UserRepository;
}

export function registerCommands(
  bot: Telegraf<BotContext>,
  deps: CommandDeps,
): void {
  bot.start(async (ctx) => {
    const payload = (ctx as { startPayload?: string }).startPayload;

    // Telegram deep-link: /start doc_<token> → re-send the file by token
    if (payload && payload.startsWith('doc_')) {
      const token = payload.slice('doc_'.length);
      const doc = await deps.documents.findByToken(token);
      if (doc) {
        try {
          await ctx.replyWithDocument({
            source: doc.filePath,
            filename: doc.filePath.split(/[\\/]/).pop(),
          });
          return;
        } catch {
          await ctx.reply('⚠️ File not available anymore.');
          return;
        }
      }
    }

    // Telegram deep-link: /start tpl_<code> → start wizard, skip template picker
    if (payload && payload.startsWith('tpl_')) {
      const code = payload.slice('tpl_'.length);
      ctx.session.pendingTemplateCode = code;
      await ctx.scene.enter(ARIZA_WIZARD_ID);
      return;
    }

    const name = ctx.from?.first_name ?? ctx.from?.username ?? '—';
    await ctx.reply(
      t(ctx.locale, 'cmd.start.greeting', { name }),
      { parse_mode: 'HTML', ...mainMenu(ctx.locale) },
    );
  });

  const sendAbout = async (ctx: BotContext): Promise<void> => {
    const stats = await loadAboutStats(deps.documents);
    const statsLine = stats
      ? `\n\n${t(ctx.locale, 'about.stats', stats)}`
      : '';
    const aboutText = `${t(ctx.locale, 'cmd.about')}${statsLine}`;
    if (config.supportContact) {
      // Inline button is attached to the same message as the bot description.
      // The persistent reply keyboard (mainMenu) is already on screen.
      await ctx.reply(aboutText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...aboutInline(ctx.locale, config.supportContact),
      });
    } else {
      await ctx.reply(
        `${aboutText}\n\n${t(ctx.locale, 'about.no_contact')}`,
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...mainMenu(ctx.locale),
        },
      );
    }
  };

  bot.help(sendAbout);
  bot.command('about', sendAbout);

  bot.command('new', (ctx) => ctx.scene.enter(ARIZA_WIZARD_ID));
  bot.command('guide', (ctx) => sendInstructionsList(ctx));
  bot.command('lang', (ctx) =>
    ctx.reply(t(ctx.locale, 'lang.pick'), {
      parse_mode: 'HTML',
      ...languageInline(ctx.locale),
    }),
  );
  bot.command('cancel', async (ctx) => {
    if (ctx.dbUser) await deps.drafts.reset(ctx.dbUser.id);
    await ctx.reply(t(ctx.locale, 'cmd.cancelled'), mainMenu(ctx.locale));
  });

  // Localized main-menu buttons → translate to actions
  bot.on('text', async (ctx, next) => {
    const text = (ctx.message as { text: string }).text?.trim() ?? '';
    const action = detectMenuAction(text);
    if (action === 'new') return ctx.scene.enter(ARIZA_WIZARD_ID);
    if (action === 'instructions') return sendInstructionsList(ctx);
    if (action === 'about') return sendAbout(ctx);
    if (action === 'lang')
      return ctx.reply(t(ctx.locale, 'lang.pick'), {
        parse_mode: 'HTML',
        ...languageInline(ctx.locale),
      });
    return next();
  });

  // Instructions flow: list → detail → "Start filling" enters wizard
  // with the chosen template pre-selected via session.pendingTemplateCode.
  bot.action(/^inst:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1]!;
    const def = getTemplateByCode(code);
    if (!def) return;
    await ctx.editMessageText(def.instructions[ctx.locale], {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...instructionsDetailInline(ctx.locale, code),
    });
  });

  bot.action('inst-back', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx.locale, 'instructions.pick'), {
      parse_mode: 'HTML',
      ...instructionsListInline(ctx.locale, TEMPLATES),
    });
  });

  bot.action(/^inst-start:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1]!;
    if (!getTemplateByCode(code)) return;
    ctx.session.pendingTemplateCode = code;
    await ctx.scene.enter(ARIZA_WIZARD_ID);
  });

  // 🏠 Close the instructions inline message — main reply keyboard stays.
  bot.action('inst:close', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      /* message too old to delete — ignore */
    }
  });

  // 🏠 Cancel the language picker — main reply keyboard stays.
  bot.action('lang:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore */
    }
  });

  // Language selection
  bot.action(/^lang:(uz_cyrillic|uz_latin|ru)$/, async (ctx) => {
    const newLocale = ctx.match[1] as Locale;
    if (ctx.dbUser) {
      await deps.users.setLanguage(ctx.dbUser.id, newLocale);
    }
    ctx.locale = newLocale;
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(newLocale, 'lang.changed', { lang: LOCALE_META[newLocale].label }),
      { parse_mode: 'HTML' },
    );
    await ctx.reply(
      t(newLocale, 'cmd.start.greeting', {
        name: ctx.from?.first_name ?? '—',
      }),
      { parse_mode: 'HTML', ...mainMenu(newLocale) },
    );
  });
}

async function sendInstructionsList(ctx: BotContext): Promise<void> {
  await ctx.reply(t(ctx.locale, 'instructions.pick'), {
    parse_mode: 'HTML',
    ...instructionsListInline(ctx.locale, TEMPLATES),
  });
}

const STATS_TTL_MS = 60_000;
let statsCache: { value: { docs: string; users: string } | null; expiresAt: number } | null = null;

async function loadAboutStats(
  documents: DocumentRepository,
): Promise<{ docs: string; users: string } | null> {
  const now = Date.now();
  if (statsCache && statsCache.expiresAt > now) return statsCache.value;
  const [docs, users] = await Promise.all([
    documents.countTotal(),
    documents.countUniqueUsers(),
  ]);
  const value = { docs: formatCount(docs), users: formatCount(users) };
  statsCache = { value, expiresAt: now + STATS_TTL_MS };
  return value;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}
