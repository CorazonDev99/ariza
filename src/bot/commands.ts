import type { Telegraf } from 'telegraf';
import { LOCALE_META, t, type Locale } from '../i18n';
import {
  detectMenuAction,
  guideDistrictCourtsInline,
  guideRegionsInline,
  instructionsDetailInline,
  instructionsListInline,
  guideCourtTypesInline,
  mainMenu,
} from './keyboards';
import { ARIZA_WIZARD_ID } from '../scenes';
import { TEMPLATES, getTemplateByCode } from '../templates/registry';
import { COURT_TYPES, getCourtTypeByCode } from '../templates/court-types';
import { REGIONS, getRegionByCode } from '../templates/regions';
import {
  getDistrictCourtByCode,
  getDistrictCourtsFor,
} from '../templates/district-courts';
import type { BotContext } from './context';
import type { DocumentRepository } from '../repositories/document.repository';
import type { DraftRepository } from '../repositories/draft.repository';
import type { UserRepository } from '../repositories/user.repository';
import { actions, type ActionDeps } from './actions';

export interface CommandDeps {
  documents: DocumentRepository;
  drafts: DraftRepository;
  users: UserRepository;
}

export function registerCommands(
  bot: Telegraf<BotContext>,
  deps: CommandDeps,
): void {
  const actionDeps: ActionDeps = {
    documents: deps.documents,
    drafts: deps.drafts,
  };

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

    await actions.start(ctx);
  });

  bot.help((ctx) => actions.about(ctx, actionDeps));
  bot.command('about', (ctx) => actions.about(ctx, actionDeps));
  bot.command('new', (ctx) => actions.newDocument(ctx));
  bot.command('guide', (ctx) => actions.guide(ctx));
  bot.command('lang', (ctx) => actions.lang(ctx));
  bot.command('cancel', (ctx) => actions.cancel(ctx, actionDeps));

  // Localized main-menu buttons (reply keyboard) → translate to actions.
  // Outside the wizard scene only — inside the scene the same detection
  // happens in `scene.on('text')` so the menu keeps working there too.
  bot.on('text', async (ctx, next) => {
    const text = (ctx.message as { text: string }).text?.trim() ?? '';
    const action = detectMenuAction(text);
    if (action === 'new') return actions.newDocument(ctx);
    if (action === 'instructions') return actions.guide(ctx);
    if (action === 'about') return actions.about(ctx, actionDeps);
    if (action === 'lang') return actions.lang(ctx);
    return next();
  });

  // ---- Guide flow: court type → region → district → template → instruction ----

  bot.action(/^g-ct:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const ct = getCourtTypeByCode(code);
    if (!ct) {
      await ctx.answerCbQuery();
      return;
    }
    if (!ct.active) {
      await ctx.answerCbQuery(t(ctx.locale, 'court-type.coming-soon'), {
        show_alert: true,
      });
      return;
    }
    ctx.session.guidePicker = { courtTypeCode: ct.code };
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx.locale, 'region.pick'), {
      parse_mode: 'HTML',
      ...guideRegionsInline(ctx.locale, REGIONS),
    });
  });

  bot.action(/^g-region:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const region = getRegionByCode(code);
    const picker = ctx.session.guidePicker;
    if (!region || !picker?.courtTypeCode) {
      await ctx.answerCbQuery();
      return;
    }
    picker.regionCode = region.code;
    picker.districtCourtCode = undefined;
    const courts = getDistrictCourtsFor(picker.courtTypeCode, region.code);
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(ctx.locale, 'district.pick', { region: region.label[ctx.locale] }),
      { parse_mode: 'HTML', ...guideDistrictCourtsInline(ctx.locale, courts) },
    );
  });

  bot.action(/^g-dc:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const dc = getDistrictCourtByCode(code);
    const picker = ctx.session.guidePicker;
    if (!dc || !picker?.regionCode) {
      await ctx.answerCbQuery();
      return;
    }
    picker.districtCourtCode = dc.code;
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx.locale, 'instructions.pick'), {
      parse_mode: 'HTML',
      ...instructionsListInline(ctx.locale, TEMPLATES),
    });
  });

  bot.action('g-back-courts', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.guidePicker = undefined;
    await ctx.editMessageText(t(ctx.locale, 'court-type.pick'), {
      parse_mode: 'HTML',
      ...guideCourtTypesInline(ctx.locale, COURT_TYPES),
    });
  });

  bot.action('g-back-regions', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.session.guidePicker) {
      ctx.session.guidePicker.regionCode = undefined;
      ctx.session.guidePicker.districtCourtCode = undefined;
    }
    await ctx.editMessageText(t(ctx.locale, 'region.pick'), {
      parse_mode: 'HTML',
      ...guideRegionsInline(ctx.locale, REGIONS),
    });
  });

  bot.action('g-back-districts', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.guidePicker;
    if (!picker?.courtTypeCode || !picker.regionCode) {
      // Session lost — restart guide from the top.
      await ctx.editMessageText(t(ctx.locale, 'court-type.pick'), {
        parse_mode: 'HTML',
        ...guideCourtTypesInline(ctx.locale, COURT_TYPES),
      });
      return;
    }
    picker.districtCourtCode = undefined;
    const courts = getDistrictCourtsFor(picker.courtTypeCode, picker.regionCode);
    const region = getRegionByCode(picker.regionCode);
    await ctx.editMessageText(
      t(ctx.locale, 'district.pick', { region: region?.label[ctx.locale] ?? '' }),
      { parse_mode: 'HTML', ...guideDistrictCourtsInline(ctx.locale, courts) },
    );
  });

  // Template picked → show instruction text. Stays inside the guide
  // flow's edited message so the user can keep navigating with the
  // inline keyboard (back/start-filling).
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

  // Back from instruction-detail → return to the filtered template list
  // (still in the same edited message). The user's earlier picks are
  // still in `session.guidePicker`.
  bot.action('inst-back', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx.locale, 'instructions.pick'), {
      parse_mode: 'HTML',
      ...instructionsListInline(ctx.locale, TEMPLATES),
    });
  });

  // "Start filling" — copy the guide's picker into pendingPicker so the
  // wizard can skip its own court/region/district steps and go straight
  // to the field collector.
  bot.action(/^inst-start:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1]!;
    if (!getTemplateByCode(code)) return;
    ctx.session.pendingTemplateCode = code;
    const p = ctx.session.guidePicker;
    if (p?.courtTypeCode && p.regionCode && p.districtCourtCode) {
      ctx.session.pendingPicker = {
        courtTypeCode: p.courtTypeCode,
        regionCode: p.regionCode,
        districtCourtCode: p.districtCourtCode,
      };
    }
    ctx.session.guidePicker = undefined;
    await ctx.scene.enter(ARIZA_WIZARD_ID);
  });

  // 🏠 Close the guide inline message — main reply keyboard stays.
  bot.action('inst:close', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.guidePicker = undefined;
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

