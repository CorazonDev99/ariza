import type { Telegraf } from 'telegraf';
import type { AdminRepository } from '../repositories/admin.repository';
import type { BotContext } from '../bot/context';
import { logger } from '../utils/logger';

export interface BroadcastPayload {
  /** Optional Telegram file_id for a photo. If set, message is a photo. */
  photoFileId?: string;
  /** Text body (or photo caption if photoFileId is set). HTML-parsed. */
  text: string;
}

export interface BroadcastProgress {
  total: number;
  sent: number;
  failed: number;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  durationMs: number;
}

/**
 * Sends a single payload to every registered Telegram user, throttled to
 * stay below Telegram's ~30 msg/sec ceiling and tolerant of per-user
 * failures (blocked bot, account deleted, etc).
 */
export class BroadcastService {
  /** Minimum ms between two sends. 50ms ≈ 20 msg/sec — safe headroom. */
  private static readonly THROTTLE_MS = 50;

  constructor(
    private readonly bot: Telegraf<BotContext>,
    private readonly admin: AdminRepository,
  ) {}

  async run(
    payload: BroadcastPayload,
    onProgress?: (p: BroadcastProgress) => void | Promise<void>,
  ): Promise<BroadcastResult> {
    const startedAt = Date.now();
    const users = await this.admin.allUsersForBroadcast();
    const total = users.length;
    let sent = 0;
    let failed = 0;

    // Report progress every N messages so we don't spam the admin chat.
    const tickEvery = Math.max(10, Math.floor(total / 20));

    for (const u of users) {
      try {
        const chatId = u.telegramId.toString();
        if (payload.photoFileId) {
          await this.bot.telegram.sendPhoto(chatId, payload.photoFileId, {
            caption: payload.text,
            parse_mode: 'HTML',
          });
        } else {
          await this.bot.telegram.sendMessage(chatId, payload.text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          });
        }
        sent += 1;
      } catch (err) {
        failed += 1;
        logger.debug(
          { err, userId: u.id, telegramId: u.telegramId.toString() },
          'broadcast delivery failed for user',
        );
      }

      if ((sent + failed) % tickEvery === 0 && onProgress) {
        try {
          await onProgress({ total, sent, failed });
        } catch {
          /* progress callback errors don't fail the broadcast */
        }
      }
      await sleep(BroadcastService.THROTTLE_MS);
    }

    const result = {
      total,
      sent,
      failed,
      durationMs: Date.now() - startedAt,
    };
    logger.info(result, 'broadcast finished');
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
