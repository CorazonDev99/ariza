import type { Telegraf } from 'telegraf';
import { LOCALE_META, t, type Locale } from '../i18n';
import {
  calendarInline,
  calendarYearInline,
  detectMenuAction,
  guideDistrictCourtsInline,
  guideRegionsInline,
  instructionsDetailInline,
  instructionsListInline,
  guideCourtTypesInline,
  jadvalCourtsInline,
  jadvalRegionsInline,
  jadvalResultsInline,
  jadvalSearchPromptInline,
  jadvalSearchResultsInline,
  jadvalTypesInline,
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
import {
  extractGlobalId,
  fetchSchedule,
  formatHumanDate,
  searchEntries,
  type CaseEntry,
} from '../services/jadval2.service';
import { logger } from '../utils/logger';
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
  bot.command('jadval', (ctx) => actions.jadval(ctx));
  bot.command('lang', (ctx) => actions.lang(ctx));
  bot.command('cancel', (ctx) => actions.cancel(ctx, actionDeps));

  // Localized main-menu buttons (reply keyboard) → translate to actions.
  // Outside the wizard scene only — inside the scene the same detection
  // happens in `scene.on('text')` so the menu keeps working there too.
  bot.on('text', async (ctx, next) => {
    const text = (ctx.message as { text: string }).text?.trim() ?? '';

    // jadval2 search mode: the next non-empty text is treated as a
    // filter query against the cached schedule, regardless of whether
    // it looks like a menu button. The user explicitly opted in by
    // tapping "🔍 Поиск", so we honor that intent first.
    if (ctx.session.jadvalPicker?.searchPending) {
      ctx.session.jadvalPicker.searchPending = false;
      if (text.length === 0) return;
      await sendScheduleReply(ctx, text);
      return;
    }

    const action = detectMenuAction(text);
    if (action === 'new') return actions.newDocument(ctx);
    if (action === 'instructions') return actions.guide(ctx);
    if (action === 'jadval') return actions.jadval(ctx);
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

  // ---- 📋 jadval2 schedule-lookup flow -------------------------------

  bot.action(/^jdv-ct:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const ct = getCourtTypeByCode(code);
    if (!ct || !ct.active) {
      await ctx.answerCbQuery();
      return;
    }
    ctx.session.jadvalPicker = { courtTypeCode: ct.code };
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx.locale, 'jadval.region.pick'), {
      parse_mode: 'HTML',
      ...jadvalRegionsInline(ctx.locale, REGIONS),
    });
  });

  bot.action(/^jdv-region:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const region = getRegionByCode(code);
    const picker = ctx.session.jadvalPicker;
    if (!region || !picker?.courtTypeCode) {
      await ctx.answerCbQuery();
      return;
    }
    picker.regionCode = region.code;
    const courts = getDistrictCourtsFor(picker.courtTypeCode, region.code);
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(ctx.locale, 'jadval.court.pick', { region: region.label[ctx.locale] }),
      { parse_mode: 'HTML', ...jadvalCourtsInline(ctx.locale, courts) },
    );
  });

  bot.action(/^jdv-court:(.+)$/, async (ctx) => {
    const courtCode = ctx.match[1]!;
    const court = getDistrictCourtByCode(courtCode);
    const picker = ctx.session.jadvalPicker;
    if (!court || !picker?.courtTypeCode) {
      await ctx.answerCbQuery();
      return;
    }
    picker.courtCode = court.code;
    picker.date = undefined;
    picker.searchPending = false;
    await ctx.answerCbQuery();
    const now = new Date();
    await ctx.editMessageText(
      t(ctx.locale, 'jadval.date.pick', { court: court.name[ctx.locale] }),
      {
        parse_mode: 'HTML',
        ...calendarInline(ctx.locale, now.getFullYear(), now.getMonth() + 1, 'jcal'),
      },
    );
  });

  // ---- jadval calendar (jcal:* mirrors cal:* but in its own namespace) ----

  bot.action(/^jcal:nav:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    await ctx.editMessageReplyMarkup(
      calendarInline(ctx.locale, y, m, 'jcal').reply_markup,
    );
  });

  bot.action('jcal:yearmode', async (ctx) => {
    await ctx.answerCbQuery();
    const now = new Date();
    await ctx.editMessageReplyMarkup(
      calendarYearInline(ctx.locale, now.getMonth() + 1, 0, undefined, 'jcal').reply_markup,
    );
  });

  bot.action(/^jcal:ypage:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = Number(ctx.match[1]);
    const monthHint = Number(ctx.match[2]);
    await ctx.editMessageReplyMarkup(
      calendarYearInline(ctx.locale, monthHint, page, undefined, 'jcal').reply_markup,
    );
  });

  bot.action(/^jcal:y:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    await ctx.editMessageReplyMarkup(
      calendarInline(ctx.locale, y, m, 'jcal').reply_markup,
    );
  });

  bot.action(/^jcal:d:(\d+):(\d+):(\d+)$/, async (ctx) => {
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    const d = Number(ctx.match[3]);
    const picker = ctx.session.jadvalPicker;
    if (!picker?.courtTypeCode || !picker.courtCode) {
      await ctx.answerCbQuery();
      return;
    }
    picker.date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    await ctx.answerCbQuery();
    await editScheduleResults(ctx);
  });

  bot.action('jcal:back', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.jadvalPicker;
    if (!picker?.courtTypeCode || !picker.regionCode) {
      await ctx.editMessageText(t(ctx.locale, 'jadval.region.pick'), {
        parse_mode: 'HTML',
        ...jadvalRegionsInline(ctx.locale, REGIONS),
      });
      return;
    }
    picker.courtCode = undefined;
    picker.date = undefined;
    const region = getRegionByCode(picker.regionCode);
    const courts = getDistrictCourtsFor(picker.courtTypeCode, picker.regionCode);
    await ctx.editMessageText(
      t(ctx.locale, 'jadval.court.pick', { region: region?.label[ctx.locale] ?? '' }),
      { parse_mode: 'HTML', ...jadvalCourtsInline(ctx.locale, courts) },
    );
  });

  bot.action('jcal:noop', async (ctx) => {
    await ctx.answerCbQuery();
  });

  // ---- jadval search + date / back ----

  bot.action('jdv-search', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.jadvalPicker;
    if (!picker?.courtCode || !picker.date) return;
    picker.searchPending = true;
    await ctx.editMessageText(t(ctx.locale, 'jadval.search.prompt'), {
      parse_mode: 'HTML',
      ...jadvalSearchPromptInline(ctx.locale),
    });
  });

  bot.action('jdv-cancel-search', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.jadvalPicker;
    if (!picker) return;
    picker.searchPending = false;
    await editScheduleResults(ctx);
  });

  bot.action('jdv-all', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.jadvalPicker;
    if (!picker) return;
    picker.searchPending = false;
    await editScheduleResults(ctx);
  });

  bot.action('jdv-date', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.session.jadvalPicker;
    if (!picker?.courtCode) return;
    const court = getDistrictCourtByCode(picker.courtCode);
    if (!court) return;
    picker.searchPending = false;
    const now = picker.date ? new Date(`${picker.date}T00:00:00`) : new Date();
    await ctx.editMessageText(
      t(ctx.locale, 'jadval.date.pick', { court: court.name[ctx.locale] }),
      {
        parse_mode: 'HTML',
        ...calendarInline(ctx.locale, now.getFullYear(), now.getMonth() + 1, 'jcal'),
      },
    );
  });

  bot.action('jdv-back-types', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.jadvalPicker = {};
    await ctx.editMessageText(t(ctx.locale, 'jadval.type.pick'), {
      parse_mode: 'HTML',
      ...jadvalTypesInline(ctx.locale, COURT_TYPES),
    });
  });

  bot.action('jdv-back-regions', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.session.jadvalPicker) {
      ctx.session.jadvalPicker.regionCode = undefined;
      ctx.session.jadvalPicker.courtCode = undefined;
      ctx.session.jadvalPicker.date = undefined;
      ctx.session.jadvalPicker.searchPending = false;
    }
    await ctx.editMessageText(t(ctx.locale, 'jadval.region.pick'), {
      parse_mode: 'HTML',
      ...jadvalRegionsInline(ctx.locale, REGIONS),
    });
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

const TELEGRAM_MESSAGE_LIMIT = 4096;

/** Escape `<`, `>`, `&` for safe Telegram HTML parse mode. */
function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderEntry(e: CaseEntry, typeCode: string): string {
  const lines: string[] = [];
  lines.push(`🕐 <b>${htmlEscape(e.time)}</b> · ${htmlEscape(e.instance)}`);
  lines.push(`📌 <code>${htmlEscape(e.caseNumber)}</code>`);
  if (e.category) lines.push(`📂 ${htmlEscape(e.category)}`);

  // For criminal: party1 = defendant (with charge), party2 = victims
  // For civil/economic/admin: party1 = claimant, party2 = defendant
  if (typeCode === 'jinoyat') {
    lines.push(`👤 ${htmlEscape(e.party1)}`);
    if (e.party2 !== '—') lines.push(`🛡️ ${htmlEscape(e.party2)}`);
  } else {
    lines.push(`👤 ${htmlEscape(e.party1)}`);
    lines.push(`   ↳ ${htmlEscape(e.party2)}`);
  }
  lines.push(`👨‍⚖️ ${htmlEscape(e.judge)}`);
  return lines.join('\n');
}

/** Build a schedule message body (no header) with Telegram's 4096-char cap.
 *  Returns the body plus the number of entries that were omitted. */
function renderEntriesCapped(
  entries: CaseEntry[],
  typeCode: string,
  headerLen: number,
): { body: string; omitted: number } {
  const rendered = entries.map((e) => renderEntry(e, typeCode));
  const sep = '\n\n';
  let body = '';
  let included = 0;
  for (const block of rendered) {
    const candidate = body ? `${body}${sep}${block}` : block;
    if (headerLen + sep.length + candidate.length > TELEGRAM_MESSAGE_LIMIT - 200) {
      break;
    }
    body = candidate;
    included += 1;
  }
  return { body, omitted: entries.length - included };
}

/** Resolve the bot's session state into a ready-to-send schedule message.
 *  Returns null when state is incomplete; throws / returns error text on
 *  network failure (caller decides whether to editMessageText or reply). */
async function buildScheduleResponse(
  ctx: BotContext,
  query?: string,
): Promise<{ text: string; isSearch: boolean; ok: boolean } | null> {
  const picker = ctx.session.jadvalPicker;
  if (!picker?.courtTypeCode || !picker.courtCode || !picker.date) {
    return null;
  }
  const court = getDistrictCourtByCode(picker.courtCode);
  if (!court) return null;

  const date = new Date(`${picker.date}T00:00:00`);
  const dateStr = formatHumanDate(date);
  const globalId = extractGlobalId(court.code);

  let allEntries: CaseEntry[];
  try {
    allEntries = await fetchSchedule(picker.courtTypeCode, globalId, date);
  } catch (err) {
    logger.warn(
      { err, court: court.code, globalId, date: picker.date },
      'jadval2 fetch failed',
    );
    return { text: t(ctx.locale, 'jadval.error'), isSearch: !!query, ok: false };
  }

  const courtName = court.name[ctx.locale];
  const isSearch = !!query && query.trim().length > 0;
  const filtered = isSearch ? searchEntries(allEntries, query!) : allEntries;

  if (allEntries.length === 0) {
    return {
      text: t(ctx.locale, 'jadval.empty', { court: courtName, date: dateStr }),
      isSearch: false,
      ok: true,
    };
  }

  if (isSearch && filtered.length === 0) {
    return {
      text: t(ctx.locale, 'jadval.search.empty', {
        court: courtName,
        date: dateStr,
        query: htmlEscape(query!),
        total: allEntries.length,
      }),
      isSearch: true,
      ok: true,
    };
  }

  const header = isSearch
    ? t(ctx.locale, 'jadval.search.header', {
        query: htmlEscape(query!),
        matched: filtered.length,
        total: allEntries.length,
        court: htmlEscape(courtName),
        date: dateStr,
      })
    : t(ctx.locale, 'jadval.header', {
        court: htmlEscape(courtName),
        date: dateStr,
        count: filtered.length,
      });

  const { body, omitted } = renderEntriesCapped(
    filtered,
    picker.courtTypeCode,
    header.length,
  );
  const footer = omitted > 0 ? t(ctx.locale, 'jadval.more', { n: omitted }) : '';
  return { text: `${header}\n\n${body}${footer}`, isSearch, ok: true };
}

function resultsKeyboard(ctx: BotContext, isSearch: boolean) {
  return isSearch
    ? jadvalSearchResultsInline(ctx.locale)
    : jadvalResultsInline(ctx.locale);
}

/** Edit the current callback message in place — used after inline-button
 *  clicks (date pick, "📋 All", "❌ Cancel search"). */
async function editScheduleResults(
  ctx: BotContext,
  query?: string,
): Promise<void> {
  const res = await buildScheduleResponse(ctx, query);
  if (!res) return;
  await ctx.editMessageText(res.text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...resultsKeyboard(ctx, res.isSearch),
  });
}

/** Send the schedule as a NEW message — used after the user types a
 *  search query (we can't edit our own message in response to theirs). */
async function sendScheduleReply(ctx: BotContext, query: string): Promise<void> {
  const res = await buildScheduleResponse(ctx, query);
  if (!res) return;
  await ctx.reply(res.text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...resultsKeyboard(ctx, res.isSearch),
  });
}

