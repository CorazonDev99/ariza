import { Scenes } from 'telegraf';
import type { Message } from 'telegraf/types';
import type { DocumentService } from '../services/document.service';
import type { DraftRepository } from '../repositories/draft.repository';
import type { DocumentRepository } from '../repositories/document.repository';
import type { TemplateRepository } from '../repositories/template.repository';
import type { PaymentService } from '../services/payment.service';
import type { AiAssistService } from '../services/ai-assist.service';
import type { TranscriptionService } from '../services/transcription.service';
import { buildWhisperPrompt } from '../services/voice-prompts';
import type { BotContext } from '../bot/context';
import { actions, type ActionDeps } from '../bot/actions';
import {
  getTemplateByCode,
  getTemplatesForCourtType,
} from '../templates/registry';
import { REGIONS, getRegionByCode } from '../templates/regions';
import { COURT_TYPES, getCourtTypeByCode } from '../templates/court-types';
import {
  getDistrictCourtByCode,
  getArizaCourtsFor,
} from '../templates/district-courts';
import { t } from '../i18n';
import type { FieldDef, WizardState } from '../types';
import {
  aiAssistRawInline,
  aiAssistRewrittenInline,
  calendarInline,
  calendarYearInline,
  choiceInline,
  courtTypesInline,
  dayPickerInline,
  detectMenuAction,
  districtCourtsInline,
  formatAmount,
  mainMenu,
  monthPickerInline,
  paymentInline,
  previewInline,
  progressBar,
  providerInline,
  regionsInline,
  removeKeyboard,
  templatesInline,
  wizardMenu,
  yearPickerInline,
} from '../bot/keyboards';
import { explainError, validate } from '../validators';
import { logger } from '../utils/logger';
import { config } from '../config';
import { openAdminPanel, openBroadcast } from '../bot/admin';

export const ARIZA_WIZARD_ID = 'ariza-wizard';

interface WizardDeps {
  templateRepo: TemplateRepository;
  /** Needed by the scene-level command shortcuts (e.g. /about inside
   *  the wizard) — the shared `actions.about` helper reads stats from
   *  this repo. */
  documentRepo: DocumentRepository;
  documentService: DocumentService;
  draftRepo: DraftRepository;
  paymentService: PaymentService;
  aiAssist: AiAssistService;
  transcription: TranscriptionService;
}

export function buildArizaWizardScene(
  deps: WizardDeps,
): Scenes.BaseScene<BotContext> {
  const scene = new Scenes.BaseScene<BotContext>(ARIZA_WIZARD_ID);

  const actionDeps: ActionDeps = {
    documents: deps.documentRepo,
    drafts: deps.draftRepo,
  };

  // ----------- global commands always work inside the scene -----------
  // Telegraf scoping rule: when the user is inside a scene, bot-level
  // command handlers do NOT fire — the scene swallows the update. Mirror
  // each global command here so /start, /about, /guide, /lang, /new,
  // /cancel keep working in the middle of the wizard. Each one leaves
  // the scene first, then runs the shared action handler. Draft is
  // preserved (the user can resume via /new) except for /cancel which
  // explicitly resets it.
  scene.command('start', async (ctx) => {
    await ctx.scene.leave();
    await actions.start(ctx);
  });
  scene.command('about', async (ctx) => {
    await ctx.scene.leave();
    await actions.about(ctx, actionDeps);
  });
  scene.command('guide', async (ctx) => {
    await ctx.scene.leave();
    await actions.guide(ctx);
  });
  scene.command('lang', async (ctx) => {
    await ctx.scene.leave();
    await actions.lang(ctx);
  });
  scene.command('new', async (ctx) => {
    await ctx.scene.leave();
    await actions.newDocument(ctx);
  });
  scene.command('cancel', async (ctx) => {
    await actions.cancel(ctx, actionDeps);
    await ctx.scene.leave();
  });
  // Admin commands also need to escape the wizard — without these, /admin
  // and /broadcast typed mid-wizard get swallowed by scene.on('text') and
  // show "👆 Use buttons" instead of opening the panel.
  scene.command('admin', async (ctx) => {
    await ctx.scene.leave();
    await openAdminPanel(ctx);
  });
  scene.command('broadcast', async (ctx) => {
    await ctx.scene.leave();
    await openBroadcast(ctx);
  });

  const getState = (ctx: BotContext): WizardState | undefined =>
    ctx.scene.session.state;
  const setState = (ctx: BotContext, s: WizardState) => {
    ctx.scene.session.state = s;
  };

  async function persist(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state || !ctx.dbUser) return;
    const draft = await deps.draftRepo.getOrCreate(ctx.dbUser.id);
    await deps.draftRepo.save(draft.id, state);
  }

  function getFields(state: WizardState): FieldDef[] {
    const def = getTemplateByCode(state.templateCode);
    return def ? def.fields : [];
  }

  /** Find next visible field index starting from `from` (inclusive). */
  function nextVisibleIndex(
    fields: FieldDef[],
    values: Record<string, string>,
    from: number,
  ): number {
    let i = from;
    while (i < fields.length) {
      const f = fields[i]!;
      if (f.skipIf && f.skipIf(values)) {
        values[f.key] = f.skipValue ?? '—';
        i += 1;
        continue;
      }
      return i;
    }
    return fields.length; // means: done, go to preview
  }

  /** Find previous visible field index strictly before `from`. */
  function prevVisibleIndex(
    fields: FieldDef[],
    values: Record<string, string>,
    from: number,
  ): number {
    let i = from - 1;
    while (i >= 0) {
      const f = fields[i]!;
      if (!(f.skipIf && f.skipIf(values))) return i;
      i -= 1;
    }
    return -1;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ----------- rendering -----------

  async function renderField(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state) return;
    const fields = getFields(state);
    // Skip over fields whose skipIf condition matches.
    const idx = nextVisibleIndex(fields, state.values, state.currentFieldIndex);
    state.currentFieldIndex = idx;
    // Reset any partial date-picker / AI-assist substate when we move to a
    // new field — leftover state from a previous step would be misleading.
    state.datePicker = undefined;
    state.aiAssist = undefined;
    setState(ctx, state);
    if (idx >= fields.length) {
      state.status = 'preview';
      setState(ctx, state);
      await persist(ctx);
      await renderPreview(ctx);
      return;
    }
    const f = fields[idx]!;
    // Count visible fields for an honest progress bar.
    const visibleTotal = fields.filter(
      (fd) => !(fd.skipIf && fd.skipIf(state.values)),
    ).length;
    const visibleCurrent = fields
      .slice(0, idx + 1)
      .filter((fd) => !(fd.skipIf && fd.skipIf(state.values)))
      .length;
    const bar = progressBar(visibleCurrent - 1, visibleTotal);
    const progress = t(ctx.locale, 'wiz.progress', {
      bar,
      current: visibleCurrent,
      total: visibleTotal,
    });
    const label = `<b>${escapeHtml(f.label[ctx.locale])}</b>`;
    const hintText = f.hint?.[ctx.locale];
    const hint = hintText
      ? f.hintCopyable
        ? `\n💡 <code>${escapeHtml(hintText)}</code>`
        : `\n💡 <i>${escapeHtml(hintText)}</i>`
      : '';
    const dft = f.defaultValue
      ? `\n${t(ctx.locale, 'wiz.use-default')}`
      : '';

    // Free-form fields accept a voice message — Whisper turns it into
    // text and runs the same validation pipe. Only show the hint when
    // transcription is actually configured AND the field is a kind
    // where voice is a sensible alternative to typing.
    const voiceField =
      f.validator === 'multiline' ||
      f.validator === 'text' ||
      f.validator === 'fio' ||
      f.validator === 'address';
    const voiceHint =
      voiceField && deps.transcription.isEnabled()
        ? `\n${t(ctx.locale, 'wiz.voice.hint')}`
        : '';

    // First send the question + reply keyboard (Back/Cancel always available).
    await ctx.reply(
      `${progress}\n\n${label}${hint}${dft}${voiceHint}`,
      { parse_mode: 'HTML', ...wizardMenu(ctx.locale) },
    );

    // For date fields (including composite splitDate) — show real
    // month-view calendar. Typing still works (text handler validates).
    if (f.validator === 'date') {
      const today = new Date();
      state.calendarPicker = {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      };
      setState(ctx, state);
      await persist(ctx);
      const sent = await ctx.reply(t(ctx.locale, 'cal.prompt'), {
        parse_mode: 'HTML',
        ...calendarInline(ctx.locale, state.calendarPicker.year, state.calendarPicker.month),
      });
      // Remember the message_id so future navigation edits it in place.
      state.calendarPicker.messageId = sent.message_id;
      setState(ctx, state);
      await persist(ctx);
    } else if (f.validator === 'year' || f.validator === 'year-month') {
      await ctx.reply(t(ctx.locale, 'dp.year.pick'), {
        ...yearPickerInline(ctx.locale, 0),
      });
    } else if (f.validator === 'month') {
      await ctx.reply(t(ctx.locale, 'dp.month.pick'), {
        ...monthPickerInline(ctx.locale, false),
      });
    } else if (f.validator === 'day') {
      await ctx.reply(t(ctx.locale, 'dp.day.pick'), {
        ...dayPickerInline(ctx.locale, false),
      });
    } else if (f.validator === 'choice' && f.choices) {
      // Inline buttons instead of typed input — one button per option.
      await ctx.reply(t(ctx.locale, 'choice.prompt'), {
        parse_mode: 'HTML',
        ...choiceInline(ctx.locale, f.key, f.choices),
      });
    }
  }

  async function renderPreview(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state) return;
    const def = getTemplateByCode(state.templateCode);
    if (!def) return;
    let n = 0;
    const lines: string[] = [];
    for (const f of def.fields) {
      if (f.skipIf && f.skipIf(state.values)) continue;
      n += 1;
      const v = state.values[f.key] ?? '—';
      const shown = v.length > 60 ? v.slice(0, 57) + '…' : v;
      lines.push(
        `<b>${n}.</b> ${escapeHtml(f.label[ctx.locale])}\n     <code>${escapeHtml(shown)}</code>`,
      );
    }
    await ctx.reply(
      `${t(ctx.locale, 'wiz.preview.title')}\n\n${lines.join('\n\n')}\n\n${t(ctx.locale, 'wiz.preview.confirm-hint')}`,
      { parse_mode: 'HTML', ...previewInline(ctx.locale) },
    );
  }

  // ----------- entry: multi-step picker (courtType → region → district → template) -----------

  scene.enter(async (ctx) => {
    // Wipe the picker scratchpad so a re-entry doesn't reuse stale picks.
    ctx.scene.session.picker = {};

    // Guide-flow path: court type, region, and district were ALL picked
    // in the "📖 Қўлланма" flow before entering the wizard. Skip every
    // picker step and go straight to template selection / field wizard.
    const prePicked = ctx.session.pendingPicker;
    const pending = ctx.session.pendingTemplateCode;
    if (prePicked) {
      ctx.session.pendingPicker = undefined;
      ctx.scene.session.picker = {
        courtTypeCode: prePicked.courtTypeCode,
        regionCode: prePicked.regionCode,
        districtCourtCode: prePicked.districtCourtCode,
      };
      if (pending) {
        ctx.session.pendingTemplateCode = undefined;
        await selectTemplate(ctx, pending, false);
        return;
      }
      // No template chosen yet — show the template picker filtered by
      // the pre-picked court type.
      await ctx.reply(t(ctx.locale, 'tmpl.pick'), {
        parse_mode: 'HTML',
        ...templatesInline(
          ctx.locale,
          getTemplatesForCourtType(prePicked.courtTypeCode),
        ),
      });
      return;
    }

    if (pending) {
      // Deep-link path: the template is fixed, but the user still needs
      // to pick a region + district. Derive the court type from the
      // template itself (defaulting to 'fuqarolik' for older entries).
      const pendingDef = getTemplateByCode(pending);
      ctx.scene.session.picker.courtTypeCode =
        pendingDef?.courtTypeCode ?? 'fuqarolik';
      await ctx.reply(t(ctx.locale, 'region.pick'), {
        parse_mode: 'HTML',
        ...regionsInline(ctx.locale, REGIONS),
      });
      return;
    }

    await ctx.reply(t(ctx.locale, 'court-type.pick'), {
      parse_mode: 'HTML',
      ...courtTypesInline(ctx.locale, COURT_TYPES),
    });
  });

  // ----------- court type pick -----------
  scene.action(/^ct:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const ct = getCourtTypeByCode(code);
    if (!ct) {
      await ctx.answerCbQuery();
      return;
    }

    if (!ct.active) {
      // Pop-up alert; keyboard stays so the user can pick another type.
      await ctx.answerCbQuery(t(ctx.locale, 'court-type.coming-soon'), {
        show_alert: true,
      });
      return;
    }

    ctx.scene.session.picker = { courtTypeCode: ct.code };

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(ctx.locale, 'court-type.chosen', { type: ct.label[ctx.locale] }),
      { parse_mode: 'HTML' },
    );
    await ctx.reply(t(ctx.locale, 'region.pick'), {
      parse_mode: 'HTML',
      ...regionsInline(ctx.locale, REGIONS),
    });
  });

  // ----------- region pick → show district courts -----------
  scene.action(/^region:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const region = getRegionByCode(code);
    const picker = ctx.scene.session.picker;
    if (!region || !picker?.courtTypeCode) {
      await ctx.answerCbQuery();
      return;
    }

    picker.regionCode = region.code;
    picker.districtCourtCode = undefined;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(ctx.locale, 'region.chosen', { region: region.label[ctx.locale] }),
      { parse_mode: 'HTML' },
    );

    const courts = getArizaCourtsFor(picker.courtTypeCode, region.code);
    await ctx.reply(
      t(ctx.locale, 'district.pick', { region: region.label[ctx.locale] }),
      {
        parse_mode: 'HTML',
        ...districtCourtsInline(ctx.locale, courts),
      },
    );
  });

  // ----------- district court pick → show templates (or jump to deep-linked one) -----------
  scene.action(/^dc:(.+)$/, async (ctx) => {
    const code = ctx.match[1]!;
    const dc = getDistrictCourtByCode(code);
    const picker = ctx.scene.session.picker;
    if (!dc || !picker?.regionCode) {
      await ctx.answerCbQuery();
      return;
    }

    picker.districtCourtCode = dc.code;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      t(ctx.locale, 'district.chosen', { court: dc.name[ctx.locale] }),
      { parse_mode: 'HTML' },
    );

    // Deep-link path: template already known — go straight to fields.
    const pending = ctx.session.pendingTemplateCode;
    if (pending) {
      ctx.session.pendingTemplateCode = undefined;
      await selectTemplate(ctx, pending, false);
      return;
    }

    await ctx.reply(t(ctx.locale, 'tmpl.pick'), {
      parse_mode: 'HTML',
      ...templatesInline(
        ctx.locale,
        getTemplatesForCourtType(picker.courtTypeCode ?? 'fuqarolik'),
      ),
    });
  });

  // ----------- template pick → create WizardState and start field wizard -----------
  //
  // Shared between two entry points:
  //   - inline button click `tmpl:<code>` (use editMessageText)
  //   - deep-link `/start tpl_<code>` after district pick (use plain reply,
  //     no callback to ack — the district pick already answered the
  //     callback query).
  async function selectTemplate(
    ctx: BotContext,
    code: string,
    fromCallback: boolean,
  ): Promise<void> {
    const def = getTemplateByCode(code);
    if (!def) {
      if (fromCallback) await ctx.answerCbQuery();
      return;
    }
    const dbTemplate = await deps.templateRepo.findByCode(code);
    if (!dbTemplate) {
      if (fromCallback) await ctx.answerCbQuery();
      await ctx.reply(t(ctx.locale, 'tmpl.not-in-db'), mainMenu(ctx.locale));
      await ctx.scene.leave();
      return;
    }

    const picker = ctx.scene.session.picker ?? {};
    const region = picker.regionCode
      ? getRegionByCode(picker.regionCode)
      : undefined;
    const district = picker.districtCourtCode
      ? getDistrictCourtByCode(picker.districtCourtCode)
      : undefined;

    const state: WizardState = {
      templateCode: def.code,
      templateDbId: dbTemplate.id,
      courtTypeCode: picker.courtTypeCode,
      regionCode: picker.regionCode,
      districtCourtCode: picker.districtCourtCode,
      currentFieldIndex: 0,
      values: {},
      status: 'collecting',
    };
    // `court_name` in the document is the region's *short* name (so the
    // header reads "Fuqarolik ishlari boʻyicha <region> tumanlararo sudi
    // raisi" naturally — see sample form). The full district court name
    // is stored separately for templates that need it.
    if (region) state.values.court_name = region.courtName[ctx.locale];
    if (district) state.values.district_court_name = district.name[ctx.locale];
    if (region) state.values.judge_name = region.judgeName[ctx.locale];

    setState(ctx, state);
    await persist(ctx);

    const chosenMsg = t(ctx.locale, 'tmpl.chosen', {
      title: def.title[ctx.locale],
      subtitle: def.subtitle[ctx.locale],
    });

    if (fromCallback) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(chosenMsg, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(chosenMsg, { parse_mode: 'HTML' });
    }
    await ctx.reply(t(ctx.locale, 'wiz.intro'), {
      parse_mode: 'HTML',
      ...wizardMenu(ctx.locale),
    });
    await renderField(ctx);
  }

  scene.action(/^tmpl:(.+)$/, async (ctx) => {
    await selectTemplate(ctx, ctx.match[1]!, true);
  });

  // ----------- back navigation between picker steps -----------

  // From region picker → court types
  scene.action('back-courts', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.session.picker = {};
    await ctx.editMessageText(t(ctx.locale, 'court-type.pick'), {
      parse_mode: 'HTML',
      ...courtTypesInline(ctx.locale, COURT_TYPES),
    });
  });

  // From district picker → regions
  scene.action('back-regions', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene.session.picker) {
      ctx.scene.session.picker.regionCode = undefined;
      ctx.scene.session.picker.districtCourtCode = undefined;
    }
    await ctx.editMessageText(t(ctx.locale, 'region.pick'), {
      parse_mode: 'HTML',
      ...regionsInline(ctx.locale, REGIONS),
    });
  });

  // From template picker → district courts
  scene.action('back-districts', async (ctx) => {
    await ctx.answerCbQuery();
    const picker = ctx.scene.session.picker;
    if (!picker?.courtTypeCode || !picker?.regionCode) {
      // Picker scratchpad was lost — restart from the top.
      await ctx.editMessageText(t(ctx.locale, 'court-type.pick'), {
        parse_mode: 'HTML',
        ...courtTypesInline(ctx.locale, COURT_TYPES),
      });
      return;
    }
    picker.districtCourtCode = undefined;
    const region = getRegionByCode(picker.regionCode);
    const courts = getArizaCourtsFor(picker.courtTypeCode, picker.regionCode);
    await ctx.editMessageText(
      t(ctx.locale, 'district.pick', {
        region: region ? region.label[ctx.locale] : picker.regionCode,
      }),
      {
        parse_mode: 'HTML',
        ...districtCourtsInline(ctx.locale, courts),
      },
    );
  });

  // 🏠 Exit the wizard from any picker step → drop the inline message,
  // reset any partial draft, and return to the persistent main menu.
  scene.action('wiz-exit', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.dbUser) await deps.draftRepo.reset(ctx.dbUser.id);
    try {
      await ctx.deleteMessage();
    } catch {
      /* message too old to delete — ignore */
    }
    await ctx.scene.leave();
  });

  // ----------- preview actions -----------

  scene.action('preview:confirm', async (ctx) => {
    const state = getState(ctx);
    if (!state || !ctx.dbUser) return ctx.scene.leave();
    await ctx.answerCbQuery();

    // Free mode: payment disabled → generate and send the PDF straight
    // away. paymentId stays undefined in the Document row, which is
    // fine — the column is nullable.
    if (!config.payment.enabled) {
      await generateAndSend(ctx);
      return;
    }

    // Paid mode: let the user pick a provider. The Payment row is
    // created only after they choose one (in startPaymentWithProvider).
    await ctx.reply(
      t(ctx.locale, 'pay.pick-provider', {
        amount: formatAmount(config.payment.amount),
      }),
      { parse_mode: 'HTML', ...providerInline(ctx.locale) },
    );
  });

  async function startPaymentWithProvider(
    ctx: BotContext,
    provider: 'click' | 'payme',
  ): Promise<void> {
    const state = getState(ctx);
    if (!state || !ctx.dbUser) return;
    const pay = await deps.paymentService.createPayment(ctx.dbUser.id, provider);
    state.status = 'awaiting_payment';
    state.paymentId = pay.paymentId;
    setState(ctx, state);
    await persist(ctx);

    const providerLabel =
      provider === 'click' ? 'Click UZ' : 'Payme';

    await ctx.reply(
      t(ctx.locale, 'pay.intro', {
        amount: formatAmount(pay.amount),
        provider: providerLabel,
      }),
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...paymentInline(ctx.locale, pay.paymentUrl, pay.amount),
      } as Parameters<typeof ctx.reply>[1],
    );
  }

  scene.action('pay:provider:click', async (ctx) => {
    await ctx.answerCbQuery();
    await startPaymentWithProvider(ctx, 'click');
  });

  scene.action('pay:provider:payme', async (ctx) => {
    await ctx.answerCbQuery();
    await startPaymentWithProvider(ctx, 'payme');
  });

  // Back from "Pay with <provider>" screen → provider picker.
  scene.action('pay:back-to-provider', async (ctx) => {
    const state = getState(ctx);
    if (!state) return ctx.scene.leave();
    // Drop the pending payment marker so checkAndMaybeFinalize doesn't fire
    // for an orphaned payment when user re-enters the flow.
    state.status = 'preview';
    state.paymentId = undefined;
    setState(ctx, state);
    await persist(ctx);
    await ctx.answerCbQuery();
    await ctx.reply(
      t(ctx.locale, 'pay.pick-provider', {
        amount: formatAmount(config.payment.amount),
      }),
      { parse_mode: 'HTML', ...providerInline(ctx.locale) },
    );
  });

  // Back from provider picker → preview.
  scene.action('pay:back-to-preview', async (ctx) => {
    const state = getState(ctx);
    if (!state) return ctx.scene.leave();
    state.status = 'preview';
    setState(ctx, state);
    await persist(ctx);
    await ctx.answerCbQuery();
    await renderPreview(ctx);
  });

  scene.action('preview:edit', async (ctx) => {
    const state = getState(ctx);
    if (!state) return ctx.scene.leave();
    // Preserve the court header values (pre-filled from the region).
    const { court_name, judge_name } = state.values;
    state.currentFieldIndex = 0;
    state.values = {};
    if (court_name !== undefined) state.values.court_name = court_name;
    if (judge_name !== undefined) state.values.judge_name = judge_name;
    state.status = 'collecting';
    setState(ctx, state);
    await persist(ctx);
    await ctx.answerCbQuery();
    await renderField(ctx);
  });

  scene.action('preview:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.dbUser) await deps.draftRepo.reset(ctx.dbUser.id);
    await ctx.reply(t(ctx.locale, 'cmd.cancelled'), mainMenu(ctx.locale));
    await ctx.scene.leave();
  });

  // ----------- date picker actions -----------
  //
  // Three field validators feed into this picker:
  //   year   — single year pick → save & advance
  //   month  — single month pick → save & advance
  //   day    — single day pick → save & advance
  //   date   — multi-step year → month → day → assemble DD.MM.YYYY & advance
  //
  // Typing in chat still works (the text handler validates as before).

  /** Save value, clear picker substate, advance to next field.
   *  For `splitDate` composites the value is canonical "DD.MM.YYYY" and
   *  we expand it into 2-3 separate keys in `state.values` (year, month,
   *  day) so .docx templates with separate placeholders keep rendering. */
  async function commitFieldValue(
    ctx: BotContext,
    value: string,
  ): Promise<void> {
    const state = getState(ctx);
    if (!state) return;
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) return;

    // year-month input arrives as canonical "MM.YYYY" (from both the
    // text validator and the picker). Turn it into a locale-friendly
    // "<month_name> <year>" for storage AND, if `splitYearMonth` is set,
    // write the year + month parts into separate keys for templates that
    // need them inline.
    if (
      f.validator === 'year-month' &&
      /^\d{2}\.\d{4}$/.test(value)
    ) {
      const m = /^(\d{2})\.(\d{4})$/.exec(value)!;
      const mm = +m[1]!;
      const yyyy = m[2]!;
      if (f.splitYearMonth) {
        state.values[f.splitYearMonth.yearKey] = yyyy;
        state.values[f.splitYearMonth.monthKey] = t(ctx.locale, `month.${mm}`);
      }
      value = `${t(ctx.locale, `month.${mm}`)} ${yyyy}`;
    }

    if (f.splitDate) {
      // Parse canonical DD.MM.YYYY
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
      if (m) {
        const dd = m[1]!;
        const mm = +m[2]!;
        const yyyy = m[3]!;
        if (f.splitDate.yearKey) state.values[f.splitDate.yearKey] = yyyy;
        state.values[f.splitDate.monthKey] = t(ctx.locale, `month.${mm}`);
        state.values[f.splitDate.dayKey] = String(+dd);
      }
      // Stash the assembled canonical date under the composite's own key
      // too, so the preview can show it as one line.
      state.values[f.key] = value;
    } else {
      state.values[f.key] = value;
    }

    state.datePicker = undefined;
    state.calendarPicker = undefined;
    state.currentFieldIndex += 1;
    setState(ctx, state);
    await persist(ctx);
    await renderField(ctx);
  }

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }

  scene.action(/^dp:ypage:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const state = getState(ctx);
    if (state?.datePicker) {
      state.datePicker.yearPage = page;
      setState(ctx, state);
      await persist(ctx);
    }
    try {
      await ctx.editMessageReplyMarkup(
        yearPickerInline(ctx.locale, page).reply_markup,
      );
    } catch {
      // If the message can't be edited (e.g. too old), send a fresh one.
      await ctx.reply(t(ctx.locale, 'dp.year.pick'), {
        ...yearPickerInline(ctx.locale, page),
      });
    }
    await ctx.answerCbQuery();
  });

  scene.action(/^dp:y:(\d{4})$/, async (ctx) => {
    const year = Number(ctx.match[1]);
    const state = getState(ctx);
    if (!state) {
      await ctx.answerCbQuery();
      return;
    }
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();

    if (f.validator === 'year') {
      await commitFieldValue(ctx, String(year));
      return;
    }
    if (f.validator === 'date' || f.validator === 'year-month') {
      state.datePicker = { step: 'month', year };
      setState(ctx, state);
      await persist(ctx);
      await ctx.reply(t(ctx.locale, 'dp.month.pick', { year }), {
        parse_mode: 'HTML',
        ...monthPickerInline(ctx.locale, true),
      });
    }
  });

  scene.action(/^dp:m:(\d{1,2})$/, async (ctx) => {
    const month = Number(ctx.match[1]);
    const state = getState(ctx);
    if (!state) {
      await ctx.answerCbQuery();
      return;
    }
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();

    if (f.validator === 'month') {
      await commitFieldValue(ctx, t(ctx.locale, `month.${month}`));
      return;
    }
    if (
      f.validator === 'year-month' &&
      state.datePicker?.year !== undefined
    ) {
      const year = state.datePicker.year;
      // Canonical "MM.YYYY" — commitFieldValue normalises it to a
      // locale-friendly display string AND writes year/month sub-keys
      // for templates that need them.
      await commitFieldValue(ctx, `${pad2(month)}.${year}`);
      return;
    }
    if (f.validator === 'date' && state.datePicker?.year !== undefined) {
      const year = state.datePicker.year;
      state.datePicker = { step: 'day', year, month };
      setState(ctx, state);
      await persist(ctx);
      await ctx.reply(
        t(ctx.locale, 'dp.day.pick', {
          year,
          month: t(ctx.locale, `month.${month}`),
        }),
        {
          parse_mode: 'HTML',
          ...dayPickerInline(ctx.locale, true),
        },
      );
    }
  });

  scene.action(/^dp:d:(\d{1,2})$/, async (ctx) => {
    const day = Number(ctx.match[1]);
    const state = getState(ctx);
    if (!state) {
      await ctx.answerCbQuery();
      return;
    }
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();

    if (f.validator === 'day') {
      await commitFieldValue(ctx, String(day));
      return;
    }
    if (
      f.validator === 'date' &&
      state.datePicker?.year !== undefined &&
      state.datePicker?.month !== undefined
    ) {
      const value = `${pad2(day)}.${pad2(state.datePicker.month)}.${state.datePicker.year}`;
      await commitFieldValue(ctx, value);
    }
  });

  // ----------- month-view calendar actions (cal:*) -----------

  /** Re-render the calendar in place. Falls back to a new message if the
   *  original was deleted / is too old to edit. */
  async function refreshCalendar(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state?.calendarPicker) return;
    const cp = state.calendarPicker;
    const text = cp.yearMode
      ? t(ctx.locale, 'cal.year.prompt', {
          month: t(ctx.locale, `month.${cp.month}`),
        })
      : t(ctx.locale, 'cal.prompt');
    const markup = cp.yearMode
      ? calendarYearInline(ctx.locale, cp.month, cp.yearPage ?? 0)
      : calendarInline(ctx.locale, cp.year, cp.month);
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...markup });
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'HTML', ...markup });
      state.calendarPicker.messageId = sent.message_id;
      setState(ctx, state);
      await persist(ctx);
    }
  }

  // Empty cells / weekday header — silent no-op.
  scene.action('cal:noop', async (ctx) => {
    await ctx.answerCbQuery();
  });

  // Navigate to a specific year-month.
  scene.action(/^cal:nav:(\d{4}):(\d{1,2})$/, async (ctx) => {
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state) return;
    state.calendarPicker = {
      ...(state.calendarPicker ?? { year: y, month: m }),
      year: y,
      month: m,
      yearMode: false,
    };
    setState(ctx, state);
    await persist(ctx);
    await refreshCalendar(ctx);
  });

  // Switch to year-jump mode.
  scene.action('cal:yearmode', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state?.calendarPicker) return;
    state.calendarPicker.yearMode = true;
    state.calendarPicker.yearPage = 0;
    setState(ctx, state);
    await persist(ctx);
    await refreshCalendar(ctx);
  });

  // Year-jump pagination.
  scene.action(/^cal:ypage:(\d+):(\d{1,2})$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state?.calendarPicker) return;
    state.calendarPicker.yearPage = page;
    state.calendarPicker.yearMode = true;
    setState(ctx, state);
    await persist(ctx);
    await refreshCalendar(ctx);
  });

  // Pick a year from year-jump → return to calendar with same month, new year.
  scene.action(/^cal:y:(\d{4}):(\d{1,2})$/, async (ctx) => {
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state?.calendarPicker) return;
    state.calendarPicker.year = y;
    state.calendarPicker.month = m;
    state.calendarPicker.yearMode = false;
    setState(ctx, state);
    await persist(ctx);
    await refreshCalendar(ctx);
  });

  // Final pick — assemble DD.MM.YYYY and commit.
  scene.action(/^cal:d:(\d{4}):(\d{1,2}):(\d{1,2})$/, async (ctx) => {
    const y = Number(ctx.match[1]);
    const m = Number(ctx.match[2]);
    const d = Number(ctx.match[3]);
    await ctx.answerCbQuery();
    const value = `${pad2(d)}.${pad2(m)}.${y}`;
    // Wipe the inline keyboard so the user can't keep clicking the calendar
    // after a date is picked.
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      /* ignore */
    }
    await commitFieldValue(ctx, value);
  });

  // Calendar "Back" — exits to the wizard's previous field, like the
  // reply-keyboard "Back" button.
  scene.action('cal:back', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state) return;
    const fields = getFields(state);
    const prev = prevVisibleIndex(fields, state.values, state.currentFieldIndex);
    if (prev < 0) return;
    state.currentFieldIndex = prev;
    state.calendarPicker = undefined;
    setState(ctx, state);
    await persist(ctx);
    await renderField(ctx);
  });

  // Back one step inside the multi-step date picker.
  scene.action('dp:back', async (ctx) => {
    const state = getState(ctx);
    if (!state?.datePicker) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    if (state.datePicker.step === 'day') {
      const year = state.datePicker.year;
      state.datePicker = { step: 'month', year };
      setState(ctx, state);
      await persist(ctx);
      await ctx.reply(t(ctx.locale, 'dp.month.pick', { year: year ?? '' }), {
        parse_mode: 'HTML',
        ...monthPickerInline(ctx.locale, true),
      });
    } else if (state.datePicker.step === 'month') {
      state.datePicker = { step: 'year', yearPage: 0 };
      setState(ctx, state);
      await persist(ctx);
      await ctx.reply(t(ctx.locale, 'dp.year.pick'), {
        ...yearPickerInline(ctx.locale, 0),
      });
    }
  });

  // ----------- choice (inline-buttons) field -----------
  //
  // For fields with validator 'choice', the user picks an option via
  // inline buttons instead of typing 1/2/etc. The callback id encodes
  // the field key so a stale click from a previous step is a no-op.
  scene.action(/^choice:([^:]+):(.+)$/, async (ctx) => {
    const fieldKey = ctx.match[1]!;
    const value = ctx.match[2]!;
    const state = getState(ctx);
    if (!state) {
      await ctx.answerCbQuery();
      return;
    }
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f || f.key !== fieldKey || f.validator !== 'choice') {
      await ctx.answerCbQuery();
      return;
    }
    // Remove the buttons so the user can't double-click and so the chat
    // shows the locked-in choice visually (the question text remains).
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await ctx.answerCbQuery(
      f.choices?.find((c) => c.value === value)?.label[ctx.locale] ?? value,
    );
    await commitFieldValue(ctx, value);
  });

  // ----------- AI-assist actions -----------
  //
  // State machine while state.aiAssist is set:
  //   raw       → [✨ improve] [✅ keep]
  //   rewritten → [✅ accept]  [🔁 retry] [✏️ original]
  //
  // All actions are gated on aiAssist.fieldKey matching the current field,
  // so a stale button press from an earlier step is a silent no-op.

  function aiAssistActive(state: WizardState): boolean {
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    return !!state.aiAssist && !!f && state.aiAssist.fieldKey === f.key;
  }

  async function runAiRewrite(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state || !state.aiAssist) return;
    const original = state.aiAssist.original;
    // Show a "thinking" placeholder so the user knows the bot is working.
    const placeholder = await ctx.reply(t(ctx.locale, 'ai.working'));
    try {
      const rewritten = await deps.aiAssist.rewriteLegalText(original, ctx.locale);
      state.aiAssist.rewritten = rewritten;
      setState(ctx, state);
      await persist(ctx);
      // Replace the placeholder with the AI candidate + decision buttons.
      try {
        await ctx.telegram.editMessageText(
          placeholder.chat.id,
          placeholder.message_id,
          undefined,
          t(ctx.locale, 'ai.result', { text: escapeHtml(rewritten) }),
          { parse_mode: 'HTML', ...aiAssistRewrittenInline(ctx.locale) },
        );
      } catch {
        await ctx.reply(
          t(ctx.locale, 'ai.result', { text: escapeHtml(rewritten) }),
          { parse_mode: 'HTML', ...aiAssistRewrittenInline(ctx.locale) },
        );
      }
    } catch (err) {
      logger.error({ err }, 'AI rewrite call failed');
      try {
        await ctx.telegram.editMessageText(
          placeholder.chat.id,
          placeholder.message_id,
          undefined,
          t(ctx.locale, 'ai.error'),
          { parse_mode: 'HTML', ...aiAssistRawInline(ctx.locale) },
        );
      } catch {
        await ctx.reply(t(ctx.locale, 'ai.error'), {
          parse_mode: 'HTML',
          ...aiAssistRawInline(ctx.locale),
        });
      }
    }
  }

  // "✨ Improve with AI" — call Claude, replace the offer with the candidate.
  scene.action('ai:improve', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state || !aiAssistActive(state)) return;
    // Strip buttons from the offer message so it can't be double-clicked.
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await runAiRewrite(ctx);
  });

  // "🔁 Retry" — call Claude again on the same original draft.
  scene.action('ai:retry', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state || !aiAssistActive(state)) return;
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await runAiRewrite(ctx);
  });

  // "✅ Keep as is" — commit the original text.
  scene.action('ai:keep', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state || !aiAssistActive(state)) return;
    const value = state.aiAssist!.original;
    state.aiAssist = undefined;
    setState(ctx, state);
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await commitFieldValue(ctx, value);
  });

  // "✅ Accept this" — commit the AI-rewritten text.
  scene.action('ai:accept', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state || !aiAssistActive(state)) return;
    const value = state.aiAssist!.rewritten ?? state.aiAssist!.original;
    state.aiAssist = undefined;
    setState(ctx, state);
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await commitFieldValue(ctx, value);
  });

  // "✏️ My text" — commit the original; user prefers their own wording.
  scene.action('ai:original', async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx);
    if (!state || !aiAssistActive(state)) return;
    const value = state.aiAssist!.original;
    state.aiAssist = undefined;
    setState(ctx, state);
    try { await ctx.editMessageReplyMarkup(undefined); } catch { /* ignore */ }
    await commitFieldValue(ctx, value);
  });

  // ----------- payment actions -----------

  // After successful payment we always generate a PDF — no format picker.
  async function generateAndSend(ctx: BotContext): Promise<void> {
    const state = getState(ctx);
    if (!state || !ctx.dbUser) {
      await ctx.scene.leave();
      return;
    }
    await ctx.reply(t(ctx.locale, 'doc.generating'), removeKeyboard);
    try {
      const result = await deps.documentService.build({
        userId: ctx.dbUser.id,
        templateDbId: state.templateDbId,
        templateCode: state.templateCode,
        values: state.values,
        format: 'pdf',
        locale: ctx.locale,
        paymentId: state.paymentId,
      });
      await ctx.replyWithDocument({
        source: result.filePath,
        filename: result.filePath.split(/[\\/]/).pop(),
      });
      await ctx.replyWithPhoto(
        { source: result.qrPng, filename: 'qr.png' },
        {
          caption: t(ctx.locale, 'doc.qr.caption', {
            url: result.downloadUrl,
          }),
          parse_mode: 'HTML',
        },
      );
      await ctx.reply(t(ctx.locale, 'doc.ready'), {
        parse_mode: 'HTML',
        ...mainMenu(ctx.locale),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to build document');
      const msg = err instanceof Error ? err.message : 'unknown';
      await ctx.reply(
        t(ctx.locale, 'doc.error', { error: msg }),
        { parse_mode: 'HTML', ...mainMenu(ctx.locale) },
      );
    } finally {
      if (ctx.dbUser) await deps.draftRepo.reset(ctx.dbUser.id);
      await ctx.scene.leave();
    }
  }

  scene.action('pay:check', async (ctx) => {
    const state = getState(ctx);
    if (!state || state.paymentId === undefined) {
      await ctx.answerCbQuery();
      return;
    }
    const status = await deps.paymentService.checkAndMaybeFinalize(
      state.paymentId,
    );
    if (status === 'paid') {
      await ctx.answerCbQuery();
      await ctx.reply(t(ctx.locale, 'pay.success'), { parse_mode: 'HTML' });
      await generateAndSend(ctx);
    } else if (status === 'pending') {
      await ctx.answerCbQuery(t(ctx.locale, 'pay.not-yet'), {
        show_alert: true,
      });
    } else {
      await ctx.answerCbQuery();
      await ctx.reply(t(ctx.locale, 'pay.failed'), mainMenu(ctx.locale));
      await ctx.scene.leave();
    }
  });

  scene.action('pay:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.dbUser) await deps.draftRepo.reset(ctx.dbUser.id);
    await ctx.reply(t(ctx.locale, 'pay.cancelled'), mainMenu(ctx.locale));
    await ctx.scene.leave();
  });

  // ----------- text handler (drives the FSM) -----------

  /**
   * Submit a raw user answer (typed or transcribed from voice) for the
   * current field. Runs validation, the multiline AI-rewrite offer, and
   * commits via `commitFieldValue` on success. Returns true if the
   * answer was accepted (and the wizard advanced).
   *
   * Pre-conditions: caller has already confirmed `state.status` is
   * 'collecting' and that there IS a current field. The aiAssist guard
   * and "-" shortcut are checked here.
   */
  async function submitAnswer(
    ctx: BotContext,
    rawText: string,
  ): Promise<boolean> {
    const state = getState(ctx);
    if (!state) return false;
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) return false;

    const trimmed = rawText.trim();

    // Allow "-" as shortcut to use default value
    if (trimmed === '-' && f.defaultValue) {
      state.values[f.key] = f.defaultValue;
      state.currentFieldIndex += 1;
      setState(ctx, state);
      await persist(ctx);
      await renderField(ctx);
      return true;
    }

    // While an AI-assist confirm/improve prompt is up for the current
    // field, plain text input is meaningless — guide the user to the
    // buttons instead of treating their reply as a new draft.
    if (state.aiAssist && state.aiAssist.fieldKey === f.key) {
      await ctx.reply(t(ctx.locale, 'wiz.use-buttons'));
      return false;
    }

    const result = validate(f.validator, rawText);
    if (!result.ok) {
      await ctx.reply(
        explainError(f.validator, result.errorKey ?? 'val.text', ctx.locale),
        { parse_mode: 'HTML', ...wizardMenu(ctx.locale) },
      );
      return false;
    }

    // For free-form `multiline` fields, offer an optional AI rewrite
    // before committing. Disabled (immediate commit) when the API key
    // isn't configured.
    if (f.validator === 'multiline' && deps.aiAssist.isEnabled()) {
      state.aiAssist = { fieldKey: f.key, original: result.value };
      setState(ctx, state);
      await persist(ctx);
      await ctx.reply(
        t(ctx.locale, 'ai.offer', { text: escapeHtml(result.value) }),
        { parse_mode: 'HTML', ...aiAssistRawInline(ctx.locale) },
      );
      return true;
    }

    // Go through commitFieldValue so splitDate composites get expanded
    // into their sub-keys consistently whether the user typed or picked.
    await commitFieldValue(ctx, result.value);
    return true;
  }

  scene.on('text', async (ctx) => {
    const text = (ctx.message as Message.TextMessage).text;
    const trimmed = text.trim();
    const menuAction = detectMenuAction(trimmed);

    // Main-menu reply-keyboard buttons must keep working mid-wizard.
    // Pressing 📄 Ariza topshirish / 📖 Қўлланма / ℹ️ Бот ҳақида / 🌐
    // Тил inside the field-collection step leaves the wizard cleanly
    // and routes to the corresponding action. Draft is preserved.
    if (menuAction === 'cancel') {
      await actions.cancel(ctx, actionDeps);
      return ctx.scene.leave();
    }
    if (menuAction === 'new') {
      await ctx.scene.leave();
      return actions.newDocument(ctx);
    }
    if (menuAction === 'instructions') {
      await ctx.scene.leave();
      return actions.guide(ctx);
    }
    if (menuAction === 'jadval') {
      await ctx.scene.leave();
      return actions.jadval(ctx);
    }
    if (menuAction === 'courtinfo') {
      await ctx.scene.leave();
      return actions.courtInfo(ctx);
    }
    if (menuAction === 'aiyurist') {
      await ctx.scene.leave();
      return actions.aiYurist(ctx);
    }
    if (menuAction === 'feedback') {
      await ctx.scene.leave();
      return actions.feedback(ctx);
    }
    if (menuAction === 'about') {
      await ctx.scene.leave();
      return actions.about(ctx, actionDeps);
    }
    if (menuAction === 'lang') {
      await ctx.scene.leave();
      return actions.lang(ctx);
    }

    const state = getState(ctx);
    if (!state) {
      await ctx.reply(
        t(ctx.locale, 'cmd.session.expired'),
        mainMenu(ctx.locale),
      );
      return ctx.scene.leave();
    }

    if (state.status !== 'collecting') {
      await ctx.reply(t(ctx.locale, 'wiz.use-buttons'));
      return;
    }

    if (menuAction === 'back') {
      const fields = getFields(state);
      const prev = prevVisibleIndex(fields, state.values, state.currentFieldIndex);
      if (prev < 0) {
        await ctx.reply(t(ctx.locale, 'wiz.at-start'), wizardMenu(ctx.locale));
        return;
      }
      state.currentFieldIndex = prev;
      setState(ctx, state);
      await persist(ctx);
      await renderField(ctx);
      return;
    }

    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) {
      state.status = 'preview';
      setState(ctx, state);
      await persist(ctx);
      await renderPreview(ctx);
      return;
    }

    await submitAnswer(ctx, text);
  });

  // ----------- voice handler — Whisper transcription on free-form fields -----------

  /**
   * Voice/audio messages are accepted ONLY on free-form text fields
   * (fio / address / text / multiline). Structured fields (dates,
   * phones, monetary amounts, fixed-format codes) need pickers or
   * typed precision — voice would just frustrate the user.
   */
  const VOICE_OK_VALIDATORS = new Set([
    'multiline',
    'text',
    'fio',
    'address',
  ]);

  async function handleVoice(ctx: BotContext, fileId: string, mimeType: string): Promise<void> {
    const state = getState(ctx);
    if (!state) {
      await ctx.reply(
        t(ctx.locale, 'cmd.session.expired'),
        mainMenu(ctx.locale),
      );
      return;
    }
    if (state.status !== 'collecting') {
      await ctx.reply(t(ctx.locale, 'wiz.use-buttons'));
      return;
    }
    const fields = getFields(state);
    const f = fields[state.currentFieldIndex];
    if (!f) return;

    if (!VOICE_OK_VALIDATORS.has(f.validator)) {
      await ctx.reply(t(ctx.locale, 'wiz.voice.not-supported-field'));
      return;
    }

    if (!deps.transcription.isEnabled()) {
      await ctx.reply(t(ctx.locale, 'wiz.voice.disabled'));
      return;
    }

    // While an AI rewrite is up, ignore voice the same way we ignore text.
    if (state.aiAssist && state.aiAssist.fieldKey === f.key) {
      await ctx.reply(t(ctx.locale, 'wiz.use-buttons'));
      return;
    }

    // "Processing" placeholder — Whisper usually returns in 1-3s but
    // network jitter on the user side makes feedback worthwhile.
    let placeholderId: number | undefined;
    try {
      const placeholder = await ctx.reply(t(ctx.locale, 'wiz.voice.processing'));
      placeholderId = placeholder.message_id;
    } catch {
      /* non-fatal */
    }

    let transcribed: string;
    try {
      const link = await ctx.telegram.getFileLink(fileId);
      const resp = await fetch(link.toString());
      if (!resp.ok) throw new Error(`telegram_file_fetch_${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const audio = Buffer.from(arrayBuf);

      transcribed = await deps.transcription.transcribe({
        audio,
        mimeType,
        filename: mimeType.includes('ogg') ? 'voice.ogg' : 'voice.bin',
        locale: ctx.locale,
        // Vocabulary hint matched to the field type — drastically
        // improves Whisper's accuracy on Uzbek names, addresses, and
        // Cyrillic letters that the model otherwise drops.
        prompt: buildWhisperPrompt(f.validator, ctx.locale),
      });
    } catch (err) {
      logger.error({ err }, 'Voice transcription failed');
      const key =
        err instanceof Error && err.message === 'audio_too_large'
          ? 'wiz.voice.too-long'
          : 'wiz.voice.failed';
      // In dev mode append the raw error code so the user can debug
      // without opening logs (e.g. `whisper_http_401` → bad API key,
      // `whisper_http_429` → rate-limit / no credits,
      // `whisper_network` → DNS / firewall blocking api.openai.com).
      const errCode =
        config.nodeEnv === 'development' && err instanceof Error
          ? `\n<code>${escapeHtml(err.message)}</code>`
          : '';
      const text = t(ctx.locale, key) + errCode;
      if (placeholderId !== undefined) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            placeholderId,
            undefined,
            text,
            { parse_mode: 'HTML' },
          );
        } catch {
          await ctx.reply(text, { parse_mode: 'HTML' });
        }
      } else {
        await ctx.reply(text, { parse_mode: 'HTML' });
      }
      return;
    }

    // Show the user what we heard, then push it through the same
    // validation/AI-rewrite path as typed text. If validation fails the
    // user just sees the usual error and can re-record.
    if (placeholderId !== undefined) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          placeholderId,
          undefined,
          t(ctx.locale, 'wiz.voice.transcribed', { text: escapeHtml(transcribed) }),
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply(
          t(ctx.locale, 'wiz.voice.transcribed', { text: escapeHtml(transcribed) }),
          { parse_mode: 'HTML' },
        );
      }
    } else {
      await ctx.reply(
        t(ctx.locale, 'wiz.voice.transcribed', { text: escapeHtml(transcribed) }),
        { parse_mode: 'HTML' },
      );
    }

    await submitAnswer(ctx, transcribed);
  }

  scene.on('voice', async (ctx) => {
    const v = (ctx.message as Message.VoiceMessage).voice;
    await handleVoice(ctx, v.file_id, v.mime_type ?? 'audio/ogg');
  });

  scene.on('audio', async (ctx) => {
    const a = (ctx.message as Message.AudioMessage).audio;
    await handleVoice(ctx, a.file_id, a.mime_type ?? 'audio/mpeg');
  });

  scene.leave(async (ctx) => {
    ctx.scene.session.state = undefined;
    ctx.scene.session.picker = undefined;
  });

  return scene;
}
