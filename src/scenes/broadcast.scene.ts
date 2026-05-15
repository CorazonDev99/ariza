import { Markup, Scenes } from 'telegraf';
import type { Message } from 'telegraf/types';
import type { BotContext } from '../bot/context';
import type { BroadcastService } from '../services/broadcast.service';
import type { AdminRepository } from '../repositories/admin.repository';
import { isAdmin } from '../bot/admin';
import { mainMenu } from '../bot/keyboards';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const BROADCAST_SCENE_ID = 'broadcast';

interface BroadcastDraft {
  photoFileId?: string;
  text: string;
}

interface BroadcastSceneSession extends Scenes.SceneSessionData {
  draft?: BroadcastDraft;
  awaiting?: 'message' | 'confirm';
}

export interface BroadcastSceneDeps {
  broadcast: BroadcastService;
  admin: AdminRepository;
}

declare module './../bot/context' {
  // Augment the scene-session shape with the broadcast draft.
  interface SceneSessionData extends BroadcastSceneSession {}
}

function previewKb(locale: BotContext['locale']) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'admin.bc.send'), 'bc:send')],
    [Markup.button.callback(t(locale, 'admin.bc.redo'), 'bc:redo')],
    [Markup.button.callback(t(locale, 'admin.bc.cancel'), 'bc:cancel')],
  ]);
}

export function buildBroadcastScene(
  deps: BroadcastSceneDeps,
): Scenes.BaseScene<BotContext> {
  const scene = new Scenes.BaseScene<BotContext>(BROADCAST_SCENE_ID);

  scene.enter(async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply(t(ctx.locale, 'admin.denied'));
      return ctx.scene.leave();
    }
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    session.draft = undefined;
    session.awaiting = 'message';
    const count = await deps.admin.userCount();
    await ctx.reply(
      t(ctx.locale, 'admin.bc.prompt', { count }),
      { parse_mode: 'HTML' },
    );
  });

  scene.on('photo', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    if (session.awaiting !== 'message') {
      await ctx.reply(t(ctx.locale, 'admin.bc.use_buttons'));
      return;
    }
    const photos = (ctx.message as Message.PhotoMessage).photo;
    const fileId = photos[photos.length - 1]!.file_id; // largest
    const caption = (ctx.message as Message.PhotoMessage).caption ?? '';
    session.draft = { photoFileId: fileId, text: caption };
    session.awaiting = 'confirm';
    await showPreview(ctx, session.draft);
  });

  scene.on('text', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    const text = (ctx.message as Message.TextMessage).text;
    if (session.awaiting !== 'message') {
      await ctx.reply(t(ctx.locale, 'admin.bc.use_buttons'));
      return;
    }
    if (!text || !text.trim()) return;
    session.draft = { text };
    session.awaiting = 'confirm';
    await showPreview(ctx, session.draft);
  });

  async function showPreview(
    ctx: BotContext,
    draft: BroadcastDraft,
  ): Promise<void> {
    const count = await deps.admin.userCount();
    await ctx.reply(t(ctx.locale, 'admin.bc.preview_header', { count }), {
      parse_mode: 'HTML',
    });
    if (draft.photoFileId) {
      await ctx.replyWithPhoto(draft.photoFileId, {
        caption: draft.text || undefined,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply(draft.text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    }
    await ctx.reply(t(ctx.locale, 'admin.bc.confirm_q'), {
      parse_mode: 'HTML',
      ...previewKb(ctx.locale),
    });
  }

  scene.action('bc:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(t(ctx.locale, 'admin.bc.cancelled'), mainMenu(ctx.locale));
    await ctx.scene.leave();
  });

  scene.action('bc:redo', async (ctx) => {
    await ctx.answerCbQuery();
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    session.draft = undefined;
    session.awaiting = 'message';
    await ctx.reply(t(ctx.locale, 'admin.bc.send_again'));
  });

  scene.action('bc:send', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery();
      return;
    }
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    const draft = session.draft;
    if (!draft) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    const start = await ctx.reply(t(ctx.locale, 'admin.bc.starting'));
    let lastEdit = 0;
    try {
      const result = await deps.broadcast.run(draft, async (p) => {
        // Throttle Telegram edits — at most one every 1.5s.
        const now = Date.now();
        if (now - lastEdit < 1500) return;
        lastEdit = now;
        try {
          await ctx.telegram.editMessageText(
            start.chat.id,
            start.message_id,
            undefined,
            t(ctx.locale, 'admin.bc.progress', {
              sent: p.sent,
              failed: p.failed,
              total: p.total,
            }),
          );
        } catch {
          /* ignore "message not modified" etc. */
        }
      });

      await ctx.reply(
        t(ctx.locale, 'admin.bc.done', {
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          seconds: Math.round(result.durationMs / 1000),
        }),
        { parse_mode: 'HTML', ...mainMenu(ctx.locale) },
      );
    } catch (err) {
      logger.error({ err }, 'broadcast failed');
      const msg = err instanceof Error ? err.message : 'unknown';
      await ctx.reply(t(ctx.locale, 'admin.bc.error', { error: msg }), {
        parse_mode: 'HTML',
        ...mainMenu(ctx.locale),
      });
    } finally {
      await ctx.scene.leave();
    }
  });

  scene.leave(async (ctx) => {
    const session =
      ctx.scene.session as BroadcastSceneSession & Scenes.SceneSessionData;
    session.draft = undefined;
    session.awaiting = undefined;
  });

  return scene;
}
