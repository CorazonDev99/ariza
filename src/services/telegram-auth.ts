import crypto from 'node:crypto';
import { logger } from '../utils/logger';

/**
 * Telegram Mini App authentication: validate the `initData` payload
 * the WebApp client passes to us as proof that it's running inside
 * an authentic Telegram client for the user it claims to be.
 *
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Validation steps:
 *   1. Parse initData as URL-encoded key/value pairs
 *   2. Extract `hash`, sort remaining keys alphabetically
 *   3. Compute HMAC-SHA256 over the sorted "key=value\n…" string
 *   4. The secret key is HMAC-SHA256("WebAppData") of BOT_TOKEN
 *   5. Compare with the provided hash in constant time
 *   6. Optionally check `auth_date` freshness (we use 24h)
 */
export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface InitDataPayload {
  user?: TelegramWebAppUser;
  auth_date: number;
  query_id?: string;
  start_param?: string;
}

const MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyInitData(
  initData: string,
  botToken: string,
): InitDataPayload | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  // Build data-check-string: sorted key=value lines joined by \n
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Constant-time compare to avoid timing side-channels
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(computed, 'hex'),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > MAX_AGE_SECONDS) {
    logger.warn({ age: nowSec - authDate }, 'initData expired');
    return null;
  }

  let user: TelegramWebAppUser | undefined;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramWebAppUser;
    } catch {
      /* malformed user JSON — treat as missing */
    }
  }

  return {
    user,
    auth_date: authDate,
    query_id: params.get('query_id') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
  };
}
