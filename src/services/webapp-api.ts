import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  COURT_TYPES,
  SCHEDULE_CATEGORIES,
  getCourtTypeByCode,
} from '../templates/court-types';
import { REGIONS, getRegionByCode } from '../templates/regions';
import {
  getInfoTypeCodes,
  getInfoRegionsForType,
  getInfoCourtsFor,
} from '../templates/court-info';
import {
  getArizaCourtsFor,
  getDistrictCourtsFor,
  getDistrictCourtByCode,
} from '../templates/district-courts';
import { TEMPLATES, getTemplateByCode } from '../templates/registry';
import {
  extractGlobalId,
  fetchSchedule,
  searchEntries,
} from './jadval2.service';
import { logger } from '../utils/logger';
import { verifyInitData, type TelegramWebAppUser } from './telegram-auth';
import { config } from '../config';
import { validate, explainError } from '../validators';
import { isLocale, type Locale } from '../i18n';
import type { UserRepository } from '../repositories/user.repository';
import type { DraftRepository } from '../repositories/draft.repository';
import type { DocumentRepository } from '../repositories/document.repository';
import type { TemplateRepository } from '../repositories/template.repository';
import type { DocumentService } from './document.service';
import type { AiAssistService } from './ai-assist.service';
import type { TranscriptionService } from './transcription.service';
import type { User } from '@prisma/client';
import type { DocumentFormat, Values } from '../types';
import { fileExists } from '../utils/fs';

/**
 * REST API for the Telegram Mini App. The bot and the Mini App share
 * the same long-lived service singletons — see BotBundle.webappServices
 * in src/bot/index.ts. All authenticated endpoints validate Telegram's
 * initData HMAC and upsert the User row, so a Mini-App-only user gets
 * the same persistence guarantees as a bot-only user.
 */

export interface ApiServices {
  users: UserRepository;
  drafts: DraftRepository;
  documents: DocumentRepository;
  templateRepo: TemplateRepository;
  documentService: DocumentService;
  aiAssist: AiAssistService;
  transcription: TranscriptionService;
}

export interface ApiContext {
  url: URL;
  res: http.ServerResponse;
  req: http.IncomingMessage;
  services: ApiServices;
}

export async function handleApi(ctx: ApiContext): Promise<boolean> {
  const { url, req } = ctx;
  const p = url.pathname.replace(/^\/api\/?/, '/');
  const m = req.method ?? 'GET';

  // ---------- Public (no initData required) ----------

  if (m === 'GET' && p === '/court-types') {
    sendJson(ctx.res, 200, COURT_TYPES.filter((t) => t.active));
    return true;
  }
  if (m === 'GET' && p === '/regions') {
    sendJson(ctx.res, 200, REGIONS);
    return true;
  }
  // Public usage stats — subscribers (users) + generated documents.
  if (m === 'GET' && p === '/stats') {
    const [users, documents] = await Promise.all([
      ctx.services.users.count(),
      ctx.services.documents.countTotal(),
    ]);
    sendJson(ctx.res, 200, { users, documents });
    return true;
  }
  // Schedule-flow entry categories: criminal (api4) + admin-offences (api5).
  if (m === 'GET' && p === '/schedule-categories') {
    sendJson(ctx.res, 200, SCHEDULE_CATEGORIES.filter((c) => c.active));
    return true;
  }
  const courtsMatch = p.match(/^\/courts\/([^/]+)\/([^/]+)$/);
  if (m === 'GET' && courtsMatch) {
    // `?for=ariza` returns the simplified list used by the document
    // wizard (jinoyat collapses to viloyat + tumanlararo, matching
    // mamuriy's structure). Anything else falls back to the full
    // schedule-flow list.
    const forArg = ctx.url.searchParams.get('for');
    const list =
      forArg === 'ariza'
        ? getArizaCourtsFor(courtsMatch[1]!, courtsMatch[2]!)
        : getDistrictCourtsFor(courtsMatch[1]!, courtsMatch[2]!);
    sendJson(ctx.res, 200, list);
    return true;
  }
  // Court directory (info) flow: type → region → court. Public.
  if (m === 'GET' && p === '/court-info/types') {
    const types = getInfoTypeCodes()
      .map((code) => getCourtTypeByCode(code))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    sendJson(ctx.res, 200, types);
    return true;
  }
  const ciRegionsMatch = p.match(/^\/court-info\/regions\/([^/]+)$/);
  if (m === 'GET' && ciRegionsMatch) {
    const present = getInfoRegionsForType(ciRegionsMatch[1]!);
    sendJson(ctx.res, 200, REGIONS.filter((r) => present.has(r.code)));
    return true;
  }
  const ciCourtsMatch = p.match(/^\/court-info\/courts\/([^/]+)\/([^/]+)$/);
  if (m === 'GET' && ciCourtsMatch) {
    sendJson(ctx.res, 200, getInfoCourtsFor(ciCourtsMatch[1]!, ciCourtsMatch[2]!));
    return true;
  }

  if (m === 'GET' && p === '/court-types/with-region') {
    // Convenience endpoint — also include the per-region pre-fill names
    // so the wizard can show "<region> вилоят суди" subtitles instantly
    // without a second round-trip.
    sendJson(ctx.res, 200, {
      types: COURT_TYPES.filter((t) => t.active),
      regions: REGIONS,
    });
    return true;
  }

  // Templates list per court type. Mirrors the bot's
  // getTemplatesByCourtType filter without exposing the heavy FieldDef
  // array — the picker UI only needs title/subtitle/code/category.
  const tmplListMatch = p.match(/^\/templates\/([^/]+)$/);
  if (m === 'GET' && tmplListMatch) {
    const courtType = tmplListMatch[1]!;
    const list = TEMPLATES.filter(
      (t) => (t.courtTypeCode ?? 'fuqarolik') === courtType,
    ).map((t) => ({
      code: t.code,
      category: t.category,
      title: t.title,
      subtitle: t.subtitle,
      courtTypeCode: t.courtTypeCode ?? 'fuqarolik',
    }));
    sendJson(ctx.res, 200, list);
    return true;
  }

  const tmplDetailMatch = p.match(/^\/template\/([^/]+)$/);
  if (m === 'GET' && tmplDetailMatch) {
    const def = getTemplateByCode(tmplDetailMatch[1]!);
    if (!def) {
      sendJson(ctx.res, 404, { error: 'template_not_found' });
      return true;
    }
    sendJson(ctx.res, 200, {
      code: def.code,
      category: def.category,
      courtTypeCode: def.courtTypeCode ?? 'fuqarolik',
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      instructions: def.instructions,
      fields: def.fields.map((f) => ({
        // skipIf is a function — can't serialize. Send a flag instead
        // so the client knows there's conditional logic; the actual
        // skip decision is duplicated client-side via the same key.
        key: f.key,
        validator: f.validator,
        label: f.label,
        hint: f.hint,
        multiline: f.multiline ?? false,
        hintCopyable: f.hintCopyable ?? false,
        defaultValue: f.defaultValue,
        choices: f.choices,
        splitDate: f.splitDate
          ? {
              yearKey: f.splitDate.yearKey,
              monthKey: f.splitDate.monthKey,
              dayKey: f.splitDate.dayKey,
            }
          : undefined,
        splitYearMonth: f.splitYearMonth,
        // Encode skipIf as a serializable rule the client can replay.
        skipRule: serializeSkipRule(def.code, f.key),
      })),
    });
    return true;
  }

  const scheduleMatch = p.match(
    /^\/schedule\/([^/]+)\/([^/]+)\/(\d{4}-\d{2}-\d{2})$/,
  );
  if (m === 'GET' && scheduleMatch) {
    await handleSchedule(
      ctx,
      scheduleMatch[1]!,
      scheduleMatch[2]!,
      scheduleMatch[3]!,
    );
    return true;
  }

  // POST /validate — server-side field validation for instant feedback.
  if (m === 'POST' && p === '/validate') {
    await handleValidate(ctx);
    return true;
  }

  // ---------- Authenticated (initData required) ----------

  if (m === 'GET' && p === '/me') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    sendJson(ctx.res, 200, normalizeUser(auth.user));
    return true;
  }

  if (m === 'POST' && p === '/language') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    const body = await readJson<{ language?: string }>(ctx);
    const lang = body?.language;
    if (!isLocale(lang)) {
      sendJson(ctx.res, 400, { error: 'invalid_language' });
      return true;
    }
    const updated = await ctx.services.users.setLanguage(auth.user.id, lang);
    sendJson(ctx.res, 200, normalizeUser(updated));
    return true;
  }

  if (m === 'POST' && p === '/generate') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    await handleGenerate(ctx, auth.user);
    return true;
  }

  if (m === 'GET' && p === '/documents') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    const docs = await ctx.services.documents.listByUser(auth.user.id, 20);
    const list = docs.map((d) => ({
      id: d.id,
      templateId: d.templateId,
      format: d.format,
      createdAt: d.createdAt,
      language: d.language,
      downloadToken: d.downloadToken,
      fileName: path.basename(d.filePath),
    }));
    sendJson(ctx.res, 200, list);
    return true;
  }

  if (m === 'POST' && p === '/ai-rewrite') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    await handleAiRewrite(ctx, auth.user);
    return true;
  }

  if (m === 'POST' && p === '/ai-yurist') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    await handleAiYurist(ctx, auth.user);
    return true;
  }

  if (m === 'POST' && p === '/transcribe') {
    const auth = await requireUser(ctx);
    if (!auth) return true;
    await handleTranscribe(ctx, auth.user);
    return true;
  }

  return false;
}

// =====================================================================
// Auth helper
// =====================================================================

interface AuthCtx {
  user: User;
  tgUser: TelegramWebAppUser;
  locale: Locale;
}

async function requireUser(ctx: ApiContext): Promise<AuthCtx | null> {
  const initData = ctx.req.headers['x-telegram-init-data'];
  if (typeof initData !== 'string' || !initData) {
    sendJson(ctx.res, 401, { error: 'missing_init_data' });
    return null;
  }
  const payload = verifyInitData(initData, config.botToken);
  if (!payload || !payload.user) {
    sendJson(ctx.res, 401, { error: 'invalid_init_data' });
    return null;
  }
  const tgUser = payload.user;
  const user = await ctx.services.users.upsert({
    telegramId: tgUser.id,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    languageCode: tgUser.language_code,
  });
  const locale: Locale = isLocale((user as { language?: unknown }).language)
    ? ((user as { language: Locale }).language)
    : 'uz_cyrillic';
  return { user, tgUser, locale };
}

function normalizeUser(u: User) {
  return {
    id: u.id,
    telegramId: u.telegramId.toString(),
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    language: (u as { language?: unknown }).language ?? 'uz_cyrillic',
  };
}

// =====================================================================
// /schedule — same as before
// =====================================================================

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
      court: { code: court.code, name: court.name },
      entries: filtered,
    });
  } catch (err) {
    logger.warn({ err, courtCode, date: dateISO, type }, 'API schedule fetch failed');
    sendJson(ctx.res, 502, { error: 'jadval2_unavailable' });
  }
}

// =====================================================================
// /validate
// =====================================================================

async function handleValidate(ctx: ApiContext): Promise<void> {
  const body = await readJson<{
    validator?: string;
    value?: string;
    locale?: string;
  }>(ctx);
  if (!body || typeof body.value !== 'string' || !body.validator) {
    sendJson(ctx.res, 400, { error: 'bad_request' });
    return;
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'uz_cyrillic';
  const result = validate(body.validator as never, body.value);
  sendJson(ctx.res, 200, {
    ok: result.ok,
    value: result.value,
    error:
      result.ok || !result.errorKey
        ? null
        : explainError(body.validator as never, result.errorKey, locale),
  });
}

// =====================================================================
// /generate
// =====================================================================

async function handleGenerate(ctx: ApiContext, user: User): Promise<void> {
  const body = await readJson<{
    templateCode?: string;
    courtTypeCode?: string;
    regionCode?: string;
    districtCourtCode?: string;
    values?: Record<string, string>;
    format?: DocumentFormat;
    locale?: string;
  }>(ctx);

  if (!body || !body.templateCode || !body.values) {
    sendJson(ctx.res, 400, { error: 'bad_request' });
    return;
  }
  const def = getTemplateByCode(body.templateCode);
  if (!def) {
    sendJson(ctx.res, 404, { error: 'template_not_found' });
    return;
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'uz_cyrillic';
  const format: DocumentFormat = body.format === 'docx' ? 'docx' : 'pdf';

  // Region + court pre-fill (mirrors the wizard's logic — see
  // ariza-wizard.scene.ts where these are written into state.values).
  const region = body.regionCode ? getRegionByCode(body.regionCode) : undefined;
  const districtCourt = body.districtCourtCode
    ? getDistrictCourtByCode(body.districtCourtCode)
    : undefined;
  const values: Values = { ...body.values };
  if (region) {
    values.court_name = region.courtName[locale];
    values.judge_name = region.judgeName[locale];
  }
  if (districtCourt) {
    values.district_court_name = districtCourt.name[locale];
  }

  // Resolve template DB id — the canonical one synced by SeedService.
  const dbTemplate = await ctx.services.templateRepo.findByCode(def.code);
  if (!dbTemplate) {
    sendJson(ctx.res, 503, { error: 'template_not_seeded' });
    return;
  }

  try {
    const result = await ctx.services.documentService.build({
      userId: user.id,
      templateDbId: dbTemplate.id,
      templateCode: def.code,
      values,
      format,
      locale,
    });
    sendJson(ctx.res, 200, {
      documentId: result.documentId,
      downloadToken: result.downloadToken,
      format: result.format,
      downloadUrl: `/api/documents/${result.downloadToken}/file`,
    });
  } catch (err) {
    logger.error({ err, templateCode: def.code }, 'Mini App generation failed');
    sendJson(ctx.res, 500, {
      error: 'generation_failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// =====================================================================
// /ai-rewrite — Claude rewrites a multiline draft
// =====================================================================

async function handleAiRewrite(ctx: ApiContext, _user: User): Promise<void> {
  void _user;
  if (!ctx.services.aiAssist.isEnabled()) {
    sendJson(ctx.res, 503, { error: 'ai_disabled' });
    return;
  }
  const body = await readJson<{ text?: string; locale?: string }>(ctx);
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    sendJson(ctx.res, 400, { error: 'bad_request' });
    return;
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'uz_cyrillic';
  try {
    const out = await ctx.services.aiAssist.rewriteLegalText(body.text, locale);
    sendJson(ctx.res, 200, { text: out });
  } catch (err) {
    logger.warn({ err }, 'Mini App AI rewrite failed');
    sendJson(ctx.res, 502, { error: 'ai_failed' });
  }
}

// =====================================================================
// /ai-yurist — answer a free-form legal question (AI legal assistant)
// =====================================================================

async function handleAiYurist(ctx: ApiContext, _user: User): Promise<void> {
  void _user;
  if (!ctx.services.aiAssist.canAnswerQuestions()) {
    sendJson(ctx.res, 503, { error: 'ai_disabled' });
    return;
  }
  const body = await readJson<{ question?: string; locale?: string }>(ctx);
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    sendJson(ctx.res, 400, { error: 'bad_request' });
    return;
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'uz_cyrillic';
  try {
    const answer = await ctx.services.aiAssist.askLegalQuestion(
      body.question,
      locale,
    );
    sendJson(ctx.res, 200, { answer });
  } catch (err) {
    logger.warn({ err }, 'Mini App AI-Yurist failed');
    sendJson(ctx.res, 502, { error: 'ai_failed' });
  }
}

// =====================================================================
// /transcribe — multipart audio → text via Whisper
// =====================================================================

async function handleTranscribe(ctx: ApiContext, _user: User): Promise<void> {
  void _user;
  if (!ctx.services.transcription.isEnabled()) {
    sendJson(ctx.res, 503, { error: 'transcription_disabled' });
    return;
  }
  const contentType = ctx.req.headers['content-type'] ?? '';
  const localeQ = ctx.url.searchParams.get('locale');
  const promptQ = ctx.url.searchParams.get('prompt') ?? undefined;
  const locale: Locale = isLocale(localeQ) ? localeQ : 'uz_cyrillic';

  let audio: Buffer;
  let mimeType = 'audio/ogg';
  let filename = 'voice.ogg';

  if (contentType.startsWith('multipart/form-data')) {
    const parsed = await readMultipartFirst(ctx);
    if (!parsed) {
      sendJson(ctx.res, 400, { error: 'no_file' });
      return;
    }
    audio = parsed.buffer;
    mimeType = parsed.mimeType || mimeType;
    filename = parsed.filename || filename;
  } else {
    // Raw audio body — simpler client path (sendsfetch with Blob body).
    audio = await readBody(ctx);
    if (contentType) mimeType = contentType.split(';')[0]!.trim();
    if (mimeType.includes('webm')) filename = 'voice.webm';
    else if (mimeType.includes('mp4') || mimeType.includes('mpeg')) filename = 'voice.mp4';
    else if (mimeType.includes('wav')) filename = 'voice.wav';
  }

  if (audio.length === 0) {
    sendJson(ctx.res, 400, { error: 'empty_audio' });
    return;
  }

  try {
    const text = await ctx.services.transcription.transcribe({
      audio,
      mimeType,
      filename,
      locale,
      prompt: promptQ,
    });
    sendJson(ctx.res, 200, { text });
  } catch (err) {
    logger.warn({ err, bytes: audio.length, mimeType }, 'Mini App transcribe failed');
    sendJson(ctx.res, 502, {
      error: 'transcribe_failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// =====================================================================
// /documents/:token/file — stream the generated document (auth via token)
//
// We accept the download token without initData because the token IS
// the auth — it was issued only to the user who generated the file,
// and the URL is delivered via a Telegram message that only they see.
// =====================================================================

export async function handleDocumentDownload(
  ctx: ApiContext,
  token: string,
): Promise<boolean> {
  if (!token || token.length < 8) {
    sendJson(ctx.res, 400, { error: 'bad_token' });
    return true;
  }
  const doc = await ctx.services.documents.findByToken(token);
  if (!doc) {
    sendJson(ctx.res, 404, { error: 'not_found' });
    return true;
  }
  if (!(await fileExists(doc.filePath))) {
    sendJson(ctx.res, 410, { error: 'file_missing' });
    return true;
  }
  const filename = path.basename(doc.filePath);
  const contentType =
    doc.format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  ctx.res.statusCode = 200;
  ctx.res.setHeader('Content-Type', contentType);
  ctx.res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );
  ctx.res.setHeader('Cache-Control', 'no-store');
  ctx.res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(doc.filePath).pipe(ctx.res);
  return true;
}

// =====================================================================
// Helpers
// =====================================================================

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Telegram-Init-Data',
  );
  res.end(JSON.stringify(body));
}

async function readBody(ctx: ApiContext): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of ctx.req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

async function readJson<T>(ctx: ApiContext): Promise<T | null> {
  const buf = await readBody(ctx);
  if (buf.length === 0) return null;
  try {
    return JSON.parse(buf.toString('utf-8')) as T;
  } catch {
    return null;
  }
}

/**
 * Tiny first-file multipart/form-data parser. Telegram Mini Apps that
 * record voice typically POST a single audio blob with a known
 * boundary, so we don't need a full multipart implementation —
 * just find the first file part and extract its bytes + filename +
 * content-type.
 */
interface MultipartPart {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}
async function readMultipartFirst(
  ctx: ApiContext,
): Promise<MultipartPart | null> {
  const ct = ctx.req.headers['content-type'] ?? '';
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
  const boundary = m ? (m[1] ?? m[2] ?? '').trim() : '';
  if (!boundary) return null;
  const raw = await readBody(ctx);
  const sep = Buffer.from(`--${boundary}`);
  const end = Buffer.from(`--${boundary}--`);

  let idx = raw.indexOf(sep);
  if (idx < 0) return null;
  idx += sep.length;
  // Skip CRLF after boundary
  if (raw[idx] === 0x0d && raw[idx + 1] === 0x0a) idx += 2;

  // Parse headers of this part
  const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), idx);
  if (headerEnd < 0) return null;
  const header = raw.slice(idx, headerEnd).toString('utf-8');
  const cd = /content-disposition:[^\r\n]*filename="([^"]+)"/i.exec(header);
  const ctHeader = /content-type:\s*([^\r\n]+)/i.exec(header);
  const filename = cd ? cd[1]! : 'voice.bin';
  const mimeType = ctHeader ? ctHeader[1]!.trim() : 'application/octet-stream';

  // Body is between headerEnd+4 and the next boundary occurrence
  const bodyStart = headerEnd + 4;
  let bodyEnd = raw.indexOf(sep, bodyStart);
  if (bodyEnd < 0) bodyEnd = raw.indexOf(end, bodyStart);
  if (bodyEnd < 0) bodyEnd = raw.length;
  // Strip trailing CRLF before boundary
  if (raw[bodyEnd - 2] === 0x0d && raw[bodyEnd - 1] === 0x0a) bodyEnd -= 2;

  return {
    buffer: raw.slice(bodyStart, bodyEnd),
    filename,
    mimeType,
  };
}

// =====================================================================
// SkipRule serializer — translates the hand-written `skipIf` arrow
// functions in src/templates/registry.ts into a tiny JSON DSL the
// front-end can replay. Mirrored by isSkipped() on the client.
// =====================================================================
export type SkipRule =
  | { kind: 'value-lt'; key: string; n: number }
  | { kind: 'not-equal'; key: string; value: string }
  | null;

function serializeSkipRule(templateCode: string, fieldKey: string): SkipRule {
  // ariza-aliment-undirish + davo-ariza-yoshgacha-taminot: child fields
  // are skipped when children_count < index. Indices encoded as
  // `child<N>_*` (1-based).
  const childMatch = fieldKey.match(/^child(\d+)_/);
  if (childMatch) {
    return { kind: 'value-lt', key: 'children_count', n: Number(childMatch[1]) };
  }
  const defMatch = fieldKey.match(/^defendant(\d+)_/);
  if (defMatch) {
    return { kind: 'value-lt', key: 'defendants_count', n: Number(defMatch[1]) };
  }
  // iltimosnoma: plaintiff_type=1 hides natural-person fields, =2 hides
  // org fields. Encoded so the client can mirror.
  if (templateCode === 'iltimosnoma-ishtiroksiz') {
    const orgOnly = ['plaintiff_org_name', 'plaintiff_stir'];
    const personOnly = ['plaintiff_fio', 'plaintiff_pinfl'];
    if (orgOnly.includes(fieldKey)) {
      return { kind: 'not-equal', key: 'plaintiff_type', value: '1' };
    }
    if (personOnly.includes(fieldKey)) {
      return { kind: 'not-equal', key: 'plaintiff_type', value: '2' };
    }
  }
  return null;
}
