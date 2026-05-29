import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URLSearchParams } from 'node:url';
import { config } from '../config';
import type { PaymentService } from '../services/payment.service';
import type { DocumentRepository } from '../repositories/document.repository';
import { fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import { handleApi } from '../services/webapp-api';

const WEBAPP_DIST = path.resolve(process.cwd(), 'webapp', 'dist');
const STATIC_EXTS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export type PaymentNotifier = (
  userId: number,
  status: 'paid' | 'failed',
  merchantTransId: string,
) => Promise<void>;

interface ClickPayload {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
  error?: string;
  error_note?: string;
}

/**
 * Single HTTP server handling:
 *   POST /click/callback   — Click UZ Prepare/Complete webhook
 *   POST /payme/callback   — Payme (Paycom) JSON-RPC webhook
 *   GET  /download/<token> — public file download for QR-code links
 */
export function startHttpServer(
  payments: PaymentService,
  documents: DocumentRepository,
  notify: PaymentNotifier,
): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'local'}`);

      // CORS pre-flight (Mini App can be on a different origin)
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Telegram-Init-Data',
        );
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.end();
        return;
      }

      // ---- /api/* — Mini App REST endpoints ----
      if (url.pathname.startsWith('/api/')) {
        const handled = await handleApi({ url, req, res });
        if (!handled) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end('{"error":"not_found"}');
        }
        return;
      }

      // ---- /webapp/* — Mini App static frontend (Vite build output) ----
      if (url.pathname.startsWith('/webapp')) {
        await serveWebApp(url, res);
        return;
      }

      // ---- GET /download/<token> ----
      if (req.method === 'GET' && req.url?.startsWith('/download/')) {
        const token = decodeURIComponent(req.url.replace('/download/', '').split('?')[0] ?? '');
        await handleDownload(documents, token, res);
        return;
      }

      // ---- POST /click/callback ----
      if (req.method === 'POST' && req.url === '/click/callback') {
        await handleClickCallback(payments, notify, req, res);
        return;
      }

      // ---- POST /payme/callback ----
      if (req.method === 'POST' && req.url === '/payme/callback') {
        await handlePaymeCallback(payments, notify, req, res);
        return;
      }

      // ---- Health ----
      if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('raport-bot is up');
        return;
      }

      res.statusCode = 404;
      res.end();
    } catch (err) {
      logger.error({ err }, 'HTTP handler error');
      res.statusCode = 500;
      res.end();
    }
  });

  server.listen(config.payment.webhookPort, () => {
    logger.info(
      { port: config.payment.webhookPort },
      'HTTP server listening (click + payme webhooks + downloads)',
    );
  });

  return server;
}

/**
 * Serve the built Vite SPA from `webapp/dist`. Any path under `/webapp`
 * that doesn't map to a file falls back to `index.html` so the React
 * router can handle deep-links.
 *
 * Path mapping:
 *   /webapp           → webapp/dist/index.html
 *   /webapp/          → webapp/dist/index.html
 *   /webapp/foo       → webapp/dist/index.html (SPA fallback)
 *   /webapp/assets/X  → webapp/dist/assets/X    (build output, hashed)
 */
async function serveWebApp(url: URL, res: http.ServerResponse): Promise<void> {
  const rel = url.pathname.replace(/^\/webapp\/?/, '') || 'index.html';

  // Prevent directory traversal by resolving and checking the prefix.
  const resolved = path.resolve(WEBAPP_DIST, rel);
  if (!resolved.startsWith(WEBAPP_DIST)) {
    res.statusCode = 400;
    res.end();
    return;
  }

  let target = resolved;
  let stat = await safeStat(target);
  if (!stat || stat.isDirectory()) {
    target = path.join(WEBAPP_DIST, 'index.html');
    stat = await safeStat(target);
  }
  if (!stat) {
    // SPA fallback — return index.html for unknown routes.
    target = path.join(WEBAPP_DIST, 'index.html');
    stat = await safeStat(target);
  }
  if (!stat) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      'Mini App not built. Run `npm run build:webapp` on the server.',
    );
    return;
  }

  const ext = path.extname(target).toLowerCase();
  const contentType = STATIC_EXTS[ext] ?? 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  // Hashed asset names from Vite ⇒ aggressive caching is safe.
  // index.html should not be cached so updates propagate immediately.
  if (target.endsWith('index.html')) {
    res.setHeader('Cache-Control', 'no-store');
  } else if (target.includes(path.sep + 'assets' + path.sep)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  fs.createReadStream(target).pipe(res);
}

async function safeStat(p: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(p);
  } catch {
    return null;
  }
}

async function handleDownload(
  documents: DocumentRepository,
  token: string,
  res: http.ServerResponse,
): Promise<void> {
  if (!token || token.length < 8) {
    res.statusCode = 400;
    res.end('Bad token');
    return;
  }
  const doc = await documents.findByToken(token);
  if (!doc) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  if (!(await fileExists(doc.filePath))) {
    res.statusCode = 410;
    res.end('File missing');
    return;
  }
  const filename = path.basename(doc.filePath);
  const contentType =
    doc.format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );
  fs.createReadStream(doc.filePath).pipe(res);
}

async function handleClickCallback(
  payments: PaymentService,
  notify: PaymentNotifier,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString('utf8');
  const parsed = parseBody(raw, req.headers['content-type']);
  logger.info({ parsed }, 'Click callback received');

  const merchantTransId = parsed.merchant_trans_id;
  const action = parsed.action;
  const valid = payments.verifyClickSignature({
    clickTransId: parsed.click_trans_id,
    serviceId: parsed.service_id,
    merchantTransId,
    merchantPrepareId: parsed.merchant_prepare_id,
    amount: parsed.amount,
    action,
    signTime: parsed.sign_time,
    signString: parsed.sign_string,
  });

  if (!valid) {
    respond(res, {
      click_trans_id: parsed.click_trans_id,
      merchant_trans_id: merchantTransId,
      error: -1,
      error_note: 'Sign check failed',
    });
    return;
  }

  if (action === '0') {
    respond(res, {
      click_trans_id: parsed.click_trans_id,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: Date.now().toString(),
      error: 0,
      error_note: 'Success',
    });
    return;
  }

  if (action === '1') {
    if (parsed.error && parsed.error !== '0') {
      await payments.markFailed(merchantTransId, parsed.error_note);
      respond(res, {
        click_trans_id: parsed.click_trans_id,
        merchant_trans_id: merchantTransId,
        error: Number(parsed.error),
        error_note: parsed.error_note ?? 'Failed',
      });
      return;
    }
    const userId = await payments.markPaid(merchantTransId, parsed.click_trans_id);
    if (userId) {
      try {
        await notify(userId, 'paid', merchantTransId);
      } catch (e) {
        logger.error({ e }, 'Failed to notify user about payment');
      }
    }
    respond(res, {
      click_trans_id: parsed.click_trans_id,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: Date.now().toString(),
      error: 0,
      error_note: 'Success',
    });
    return;
  }

  respond(res, { error: -3, error_note: 'Unknown action' });
}

function parseBody(raw: string, contentType: string | undefined): ClickPayload {
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(raw) as ClickPayload;
    } catch {
      return {} as ClickPayload;
    }
  }
  const params = new URLSearchParams(raw);
  const obj: Record<string, string> = {};
  for (const [k, v] of params) obj[k] = v;
  return obj as unknown as ClickPayload;
}

function respond(res: http.ServerResponse, body: Record<string, unknown>): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Backward-compat alias for code that still imports the old name.
export const startClickWebhookServer = startHttpServer;

// =====================================================================
// Payme (Paycom) JSON-RPC webhook
// =====================================================================
//
// Paycom calls our endpoint with one of these methods:
//   CheckPerformTransaction — validate that we accept this payment
//   CreateTransaction       — Paycom opens a transaction on its side
//   PerformTransaction      — payment confirmed, mark as paid
//   CancelTransaction       — payment cancelled / refunded
//   CheckTransaction        — Paycom asks for current state
//   GetStatement            — billing reconciliation (optional)
//
// Auth: HTTP Basic "Paycom:<PAYME_KEY>"
// Errors follow JSON-RPC 2.0 with Paycom-specific codes:
//   -31001 wrong amount
//   -31050 user not found / order not found
//   -31008 unable to perform
//   -32504 invalid auth
//   -31003 transaction not found
// =====================================================================

interface PaymeRpcRequest {
  id: number | string;
  method: string;
  params: {
    id?: string;                       // paycom transaction id
    time?: number;
    amount?: number;                   // tiyin
    account?: { order_id?: string };
    reason?: number;
  };
}

async function handlePaymeCallback(
  payments: PaymentService,
  notify: PaymentNotifier,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const auth = req.headers['authorization'];
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString('utf8');

  let rpc: PaymeRpcRequest;
  try {
    rpc = JSON.parse(raw) as PaymeRpcRequest;
  } catch {
    paymeRespond(res, null, paymeError(-32700, 'Parse error'));
    return;
  }

  logger.info({ method: rpc.method, params: rpc.params }, 'Payme callback');

  if (!payments.verifyPaymeAuth(auth)) {
    paymeRespond(res, rpc.id, paymeError(-32504, 'Insufficient privileges'));
    return;
  }

  const orderId = rpc.params.account?.order_id ?? '';

  switch (rpc.method) {
    case 'CheckPerformTransaction': {
      const p = await payments.findByMerchantTransId(orderId);
      if (!p) {
        paymeRespond(res, rpc.id, paymeError(-31050, 'Order not found', 'order_id'));
        return;
      }
      if (rpc.params.amount !== p.amount * 100) {
        paymeRespond(res, rpc.id, paymeError(-31001, 'Wrong amount'));
        return;
      }
      paymeRespond(res, rpc.id, { result: { allow: true } });
      return;
    }

    case 'CreateTransaction': {
      const p = await payments.findByMerchantTransId(orderId);
      if (!p) {
        paymeRespond(res, rpc.id, paymeError(-31050, 'Order not found', 'order_id'));
        return;
      }
      if (rpc.params.amount !== p.amount * 100) {
        paymeRespond(res, rpc.id, paymeError(-31001, 'Wrong amount'));
        return;
      }
      paymeRespond(res, rpc.id, {
        result: {
          transaction: rpc.params.id,
          state: 1,
          create_time: rpc.params.time ?? Date.now(),
        },
      });
      return;
    }

    case 'PerformTransaction': {
      const userId = await payments.markPaid(orderId, rpc.params.id);
      if (userId === null) {
        paymeRespond(res, rpc.id, paymeError(-31003, 'Transaction not found'));
        return;
      }
      try {
        await notify(userId, 'paid', orderId);
      } catch (e) {
        logger.error({ e }, 'Failed to notify user about Payme payment');
      }
      paymeRespond(res, rpc.id, {
        result: {
          transaction: rpc.params.id,
          state: 2,
          perform_time: Date.now(),
        },
      });
      return;
    }

    case 'CancelTransaction': {
      await payments.markFailed(orderId, `payme:cancel:${rpc.params.reason ?? ''}`);
      paymeRespond(res, rpc.id, {
        result: {
          transaction: rpc.params.id,
          state: -1,
          cancel_time: Date.now(),
        },
      });
      return;
    }

    case 'CheckTransaction': {
      const p = await payments.findByMerchantTransId(orderId);
      if (!p) {
        paymeRespond(res, rpc.id, paymeError(-31003, 'Transaction not found'));
        return;
      }
      const state = p.status === 'paid' ? 2 : p.status === 'failed' ? -1 : 1;
      paymeRespond(res, rpc.id, {
        result: {
          transaction: rpc.params.id,
          state,
          create_time: p.createdAt?.getTime?.() ?? Date.now(),
          perform_time: p.paidAt?.getTime?.() ?? 0,
          cancel_time: 0,
        },
      });
      return;
    }

    default:
      paymeRespond(res, rpc.id, paymeError(-32601, 'Method not found'));
  }
}

function paymeError(code: number, message: string, data?: string) {
  return { error: { code, message, ...(data ? { data } : {}) } };
}

function paymeRespond(
  res: http.ServerResponse,
  id: number | string | null,
  body: Record<string, unknown>,
): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', id, ...body }));
}
