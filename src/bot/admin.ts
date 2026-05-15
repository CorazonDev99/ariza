import { Markup, type Telegraf } from 'telegraf';
import type { BotContext } from './context';
import type {
  AdminRepository,
  PeriodStats,
  StatsPeriod,
} from '../repositories/admin.repository';
import { config } from '../config';
import { t } from '../i18n';
import { mainMenu } from './keyboards';
import { BROADCAST_SCENE_ID } from '../scenes/broadcast.scene';
import { XlsxReportService } from '../services/xlsx-report.service';
import { logger } from '../utils/logger';

export interface AdminDeps {
  admin: AdminRepository;
}

const xlsxReports = new XlsxReportService();

export function isAdmin(ctx: BotContext): boolean {
  const id = ctx.from?.id;
  if (id === undefined) return false;
  return config.adminChatIds.includes(id);
}

const PERIODS: StatsPeriod[] = ['day', 'week', 'month', 'all'];

function periodLabel(locale: BotContext['locale'], p: StatsPeriod): string {
  return t(locale, `admin.period.${p}`);
}

function adminRootKb(locale: BotContext['locale']) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'admin.btn.stats'), 'admin:stats:day')],
    [Markup.button.callback(t(locale, 'admin.btn.payments'), 'admin:payments')],
    [Markup.button.callback(t(locale, 'admin.btn.broadcast'), 'admin:broadcast')],
    [Markup.button.callback(t(locale, 'admin.btn.close'), 'admin:close')],
  ]);
}

/** Period picker for the XLSX-report flow — no "currently selected"
 *  highlight, since each click triggers a download rather than refreshing
 *  the view. */
function paymentReportKb(locale: BotContext['locale']) {
  return Markup.inlineKeyboard([
    PERIODS.map((p) =>
      Markup.button.callback(periodLabel(locale, p), `admin:payments:${p}`),
    ),
    [Markup.button.callback(t(locale, 'admin.btn.back'), 'admin:menu')],
  ]);
}

function periodKb(
  locale: BotContext['locale'],
  base: 'admin:stats' | 'admin:payments',
  current: StatsPeriod,
) {
  return Markup.inlineKeyboard([
    PERIODS.map((p) =>
      Markup.button.callback(
        (p === current ? '• ' : '') + periodLabel(locale, p),
        `${base}:${p}`,
      ),
    ),
    [Markup.button.callback(t(locale, 'admin.btn.back'), 'admin:menu')],
  ]);
}

function fmtSum(n: number): string {
  // 1500000 → "1 500 000"
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

function fmtDate(d: Date): string {
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderStats(
  locale: BotContext['locale'],
  stats: PeriodStats,
): string {
  const range =
    stats.from === null
      ? t(locale, 'admin.range.all')
      : `${fmtDate(stats.from)} — ${fmtDate(stats.to)}`;

  const top =
    stats.topTemplates.length === 0
      ? '—'
      : stats.topTemplates
          .map((x) => `• ${escapeHtml(x.title)} <b>×${x.count}</b>`)
          .join('\n');

  const byLang =
    stats.byLanguage.length === 0
      ? '—'
      : stats.byLanguage
          .map((x) => `• <code>${escapeHtml(x.language)}</code> — ${x.count}`)
          .join('\n');

  return [
    t(locale, 'admin.stats.title', { period: periodLabel(locale, stats.period) }),
    `<i>${escapeHtml(range)}</i>`,
    '',
    t(locale, 'admin.stats.new_users', { n: stats.newUsers }),
    t(locale, 'admin.stats.documents', { n: stats.documents }),
    '',
    `<b>${t(locale, 'admin.stats.payments_header')}</b>`,
    t(locale, 'admin.stats.paid', {
      count: stats.payments.paidCount,
      sum: fmtSum(stats.payments.paidSum),
    }),
    t(locale, 'admin.stats.pending', { n: stats.payments.pending }),
    t(locale, 'admin.stats.failed', { n: stats.payments.failed }),
    t(locale, 'admin.stats.cancelled', { n: stats.payments.cancelled }),
    '',
    `<b>${t(locale, 'admin.stats.top_templates')}</b>`,
    top,
    '',
    `<b>${t(locale, 'admin.stats.by_language')}</b>`,
    byLang,
  ].join('\n');
}

/**
 * Telegram throws 400 "message is not modified" when the same button is
 * clicked twice. That isn't an error from the admin's perspective, so we
 * just swallow it here.
 */
async function safeEdit(
  ctx: BotContext,
  text: string,
  extra: Parameters<BotContext['editMessageText']>[1],
): Promise<void> {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('message is not modified')) return;
    throw err;
  }
}

export function registerAdmin(
  bot: Telegraf<BotContext>,
  deps: AdminDeps,
): void {
  // Gate every admin entry on the allowlist.
  const gate = async (
    ctx: BotContext,
    handler: () => Promise<unknown> | unknown,
  ): Promise<void> => {
    if (!isAdmin(ctx)) {
      await ctx.reply(t(ctx.locale, 'admin.denied'));
      return;
    }
    await handler();
  };

  bot.command('admin', async (ctx) => {
    await gate(ctx, async () => {
      await ctx.reply(t(ctx.locale, 'admin.menu'), {
        parse_mode: 'HTML',
        ...adminRootKb(ctx.locale),
      });
    });
  });

  bot.action('admin:menu', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    await safeEdit(ctx, t(ctx.locale, 'admin.menu'), {
      parse_mode: 'HTML',
      ...adminRootKb(ctx.locale),
    });
  });

  bot.action('admin:close', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      /* if too old to delete, just leave it */
    }
    await ctx.reply(t(ctx.locale, 'admin.closed'), mainMenu(ctx.locale));
  });

  bot.action(/^admin:stats:(day|week|month|all)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    const period = ctx.match[1] as StatsPeriod;
    await ctx.answerCbQuery();
    const stats = await deps.admin.stats(period);
    await safeEdit(ctx, renderStats(ctx.locale, stats), {
      parse_mode: 'HTML',
      ...periodKb(ctx.locale, 'admin:stats', period),
    });
  });

  // Step 1: show period picker (no list — that's intentional).
  bot.action('admin:payments', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    await safeEdit(ctx, t(ctx.locale, 'admin.payments.pick'), {
      parse_mode: 'HTML',
      ...paymentReportKb(ctx.locale),
    });
  });

  // Step 2: build XLSX report for the chosen period and send as a document.
  bot.action(/^admin:payments:(day|week|month|all)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    const period = ctx.match[1] as StatsPeriod;
    await ctx.answerCbQuery(t(ctx.locale, 'admin.payments.generating'));

    try {
      const rows = await deps.admin.paymentsForExport(period);
      const report = await xlsxReports.buildPaymentsReport(
        rows,
        period,
        ctx.locale,
      );
      await ctx.replyWithDocument(
        { source: report.buffer, filename: report.filename },
        {
          caption: t(ctx.locale, 'admin.payments.report.caption', {
            period: periodLabel(ctx.locale, period),
            count: report.rowCount,
            sum: fmtSum(report.paidSum),
          }),
          parse_mode: 'HTML',
        },
      );
    } catch (err) {
      logger.error({ err, period }, 'payments XLSX export failed');
      const msg = err instanceof Error ? err.message : 'unknown';
      await ctx.reply(
        t(ctx.locale, 'admin.payments.report.error', { error: msg }),
        { parse_mode: 'HTML' },
      );
    }
  });

  bot.action('admin:broadcast', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    await ctx.scene.enter(BROADCAST_SCENE_ID);
  });

  // Shortcut: /broadcast also opens the broadcast scene.
  bot.command('broadcast', async (ctx) => {
    await gate(ctx, () => ctx.scene.enter(BROADCAST_SCENE_ID));
  });
}
