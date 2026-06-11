import { t } from '../i18n';
import { config } from '../config';
import { ARIZA_WIZARD_ID } from '../scenes';
import {
  COURT_TYPES,
  getCourtTypeByCode,
  type CourtTypeDef,
} from '../templates/court-types';
import { getInfoTypeCodes } from '../templates/court-info';
import {
  aboutInline,
  aiYuristExitInline,
  courtInfoTypesInline,
  feedbackCancelInline,
  guideCourtTypesInline,
  jadvalTypesInline,
  languageInline,
  mainMenu,
} from './keyboards';
import type { BotContext } from './context';
import type { DocumentRepository } from '../repositories/document.repository';
import type { DraftRepository } from '../repositories/draft.repository';

export interface ActionDeps {
  documents: DocumentRepository;
  drafts: DraftRepository;
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

/** Shared menu / command actions. Called from both `commands.ts`
 *  (top-level /commands + reply-keyboard taps) and the wizard scene
 *  (so the same commands keep working even mid-wizard). */
export const actions = {
  async start(ctx: BotContext): Promise<void> {
    const name = ctx.from?.first_name ?? ctx.from?.username ?? '—';
    await ctx.reply(
      t(ctx.locale, 'cmd.start.greeting', { name }),
      { parse_mode: 'HTML', ...mainMenu(ctx.locale) },
    );
  },

  async about(ctx: BotContext, deps: ActionDeps): Promise<void> {
    const stats = await loadAboutStats(deps.documents);
    const statsLine = stats
      ? `\n\n${t(ctx.locale, 'about.stats', stats)}`
      : '';
    const aboutText = `${t(ctx.locale, 'cmd.about')}${statsLine}`;
    if (config.supportContact || config.channelUrl) {
      await ctx.reply(aboutText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...aboutInline(ctx.locale, config.supportContact, config.channelUrl),
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
  },

  async newDocument(ctx: BotContext): Promise<void> {
    await ctx.scene.enter(ARIZA_WIZARD_ID);
  },

  async guide(ctx: BotContext): Promise<void> {
    ctx.session.guidePicker = undefined;
    await ctx.reply(t(ctx.locale, 'court-type.pick'), {
      parse_mode: 'HTML',
      ...guideCourtTypesInline(ctx.locale, COURT_TYPES),
    });
  },

  async jadval(ctx: BotContext): Promise<void> {
    ctx.session.jadvalPicker = {};
    await ctx.reply(t(ctx.locale, 'jadval.type.pick'), {
      parse_mode: 'HTML',
      ...jadvalTypesInline(ctx.locale, COURT_TYPES),
    });
  },

  async courtInfo(ctx: BotContext): Promise<void> {
    ctx.session.courtInfoPicker = {};
    const types = getInfoTypeCodes()
      .map((c) => getCourtTypeByCode(c))
      .filter((c): c is CourtTypeDef => Boolean(c));
    await ctx.reply(t(ctx.locale, 'courtinfo.type.pick'), {
      parse_mode: 'HTML',
      ...courtInfoTypesInline(ctx.locale, types),
    });
  },

  async lang(ctx: BotContext): Promise<void> {
    await ctx.reply(t(ctx.locale, 'lang.pick'), {
      parse_mode: 'HTML',
      ...languageInline(ctx.locale),
    });
  },

  async feedback(ctx: BotContext): Promise<void> {
    if (!config.feedbackGroupId) {
      await ctx.reply(t(ctx.locale, 'feedback.disabled'), mainMenu(ctx.locale));
      return;
    }
    ctx.session.feedbackPending = true;
    await ctx.reply(t(ctx.locale, 'feedback.prompt'), {
      parse_mode: 'HTML',
      ...feedbackCancelInline(ctx.locale),
    });
  },

  async aiYurist(ctx: BotContext): Promise<void> {
    if (!config.ai.openaiKey && !config.ai.apiKey) {
      await ctx.reply(t(ctx.locale, 'aiyurist.disabled'), mainMenu(ctx.locale));
      return;
    }
    ctx.session.feedbackPending = false;
    ctx.session.aiYuristPending = true;
    await ctx.reply(t(ctx.locale, 'aiyurist.intro'), {
      parse_mode: 'HTML',
      ...aiYuristExitInline(ctx.locale),
    });
  },

  async cancel(ctx: BotContext, deps: ActionDeps): Promise<void> {
    if (ctx.dbUser) await deps.drafts.reset(ctx.dbUser.id);
    await ctx.reply(t(ctx.locale, 'cmd.cancelled'), mainMenu(ctx.locale));
  },
};
