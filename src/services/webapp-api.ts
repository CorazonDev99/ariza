import http from 'node:http';
import { COURT_TYPES } from '../templates/court-types';
import { REGIONS } from '../templates/regions';
import {
  getDistrictCourtsFor,
  getDistrictCourtByCode,
} from '../templates/district-courts';
import {
  extractGlobalId,
  fetchSchedule,
  searchEntries,
} from './jadval2.service';
import { logger } from '../utils/logger';
import { verifyInitData } from './telegram-auth';
import { config } from '../config';

/**
 * REST API for the Telegram Mini App. Mounted under `/api/*` by the
 * single HTTP server in webhook.ts. Read-only for now — court lists,
 * regions, and the live jadval2 schedule.
 *
 * Auth model: only the /api/me endpoint requires a valid initData
 * signature. Court/schedule reads are public because jadval2 itself is
 * public — we just want users to be able to look without onboarding
 * friction. If we later add document generation / drafts, those will
 * require initData auth.
 */
export interface ApiContext {
  url: URL;
  res: http.ServerResponse;
  req: http.IncomingMessage;
}

export async function handleApi(ctx: ApiContext): Promise<boolean> {
  const { url } = ctx;
  const path = url.pathname.replace(/^\/api\/?/, '/');

  // GET /me — validate initData, return user info
  if (ctx.req.method === 'GET' && path === '/me') {
    await handleMe(ctx);
    return true;
  }

  // GET /court-types
  if (ctx.req.method === 'GET' && path === '/court-types') {
    sendJson(ctx.res, 200, COURT_TYPES.filter((t) => t.active));
    return true;
  }

  // GET /regions
  if (ctx.req.method === 'GET' && path === '/regions') {
    sendJson(ctx.res, 200, REGIONS);
    return true;
  }

  // GET /courts/:type/:region
  const courtsMatch = path.match(/^\/courts\/([^/]+)\/([^/]+)$/);
  if (ctx.req.method === 'GET' && courtsMatch) {
    const [, type, region] = courtsMatch;
    const list = getDistrictCourtsFor(type!, region!);
    sendJson(ctx.res, 200, list);
    return true;
  }

  // GET /schedule/:type/:courtCode/:dateISO
  // dateISO format: YYYY-MM-DD. Optional `?q=substring` for filtering.
  const scheduleMatch = path.match(/^\/schedule\/([^/]+)\/([^/]+)\/(\d{4}-\d{2}-\d{2})$/);
  if (ctx.req.method === 'GET' && scheduleMatch) {
    await handleSchedule(ctx, scheduleMatch[1]!, scheduleMatch[2]!, scheduleMatch[3]!);
    return true;
  }

  return false;
}

async function handleMe(ctx: ApiContext): Promise<void> {
  const initData = ctx.req.headers['x-telegram-init-data'];
  if (typeof initData !== 'string') {
    sendJson(ctx.res, 401, { error: 'missing_init_data' });
    return;
  }
  const payload = verifyInitData(initData, config.botToken);
  if (!payload) {
    sendJson(ctx.res, 401, { error: 'invalid_init_data' });
    return;
  }
  sendJson(ctx.res, 200, {
    user: payload.user ?? null,
    auth_date: payload.auth_date,
  });
}

async function handleSchedule(
  ctx: ApiContext,
  type: string,
  courtCode: string,
  dateISO: string,
): Promise<void> {
  const court = getDistrictCourtByCode(courtCode);
  if (!court) {
    sendJson(ctx.res, 404, { error: 'court_not_found' });
    return;
  }

  // Block past dates upfront — jadval2 returns HTTP 400 for them, and
  // the frontend's calendar greys them out anyway. Defense in depth.
  const date = new Date(`${dateISO}T00:00:00`);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (date < startOfToday) {
    sendJson(ctx.res, 400, { error: 'past_date_not_available' });
    return;
  }

  const globalId = extractGlobalId(court.code);
  try {
    const all = await fetchSchedule(type, globalId, date);
    const q = ctx.url.searchParams.get('q')?.trim() ?? '';
    const filtered = q ? searchEntries(all, q) : all;
    sendJson(ctx.res, 200, {
      total: all.length,
      matched: filtered.length,
      query: q || null,
      court: {
        code: court.code,
        name: court.name,
      },
      entries: filtered,
    });
  } catch (err) {
    logger.warn({ err, courtCode, date: dateISO, type }, 'API schedule fetch failed');
    sendJson(ctx.res, 502, { error: 'jadval2_unavailable' });
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // Mini App and bot are different origins (botfather URL vs t.me) — open CORS.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  res.end(JSON.stringify(body));
}
