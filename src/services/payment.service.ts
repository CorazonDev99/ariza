import crypto from 'node:crypto';
import type { PaymentRepository } from '../repositories/payment.repository';
import { config } from '../config';
import { logger } from '../utils/logger';

export type PaymentProvider = 'click' | 'payme';

export interface CreatePaymentResult {
  paymentId: number;
  merchantTransId: string;
  amount: number;
  provider: PaymentProvider;
  paymentUrl: string;
}

/**
 * Multi-provider payment service.
 *
 * Click UZ flow:
 *   1) build URL https://my.click.uz/services/pay with service/merchant ids
 *   2) Click POSTs `Prepare`/`Complete` to our /click/callback webhook
 *      (signature is md5(...) — see verifyClickSignature)
 *
 * Payme (Paycom) flow:
 *   1) build URL https://checkout.paycom.uz/<base64-of-m=...;ac.order_id=...;a=...>
 *   2) Paycom POSTs JSON-RPC to our /payme/callback webhook
 *      (auth is HTTP Basic "Paycom:<KEY>" — see verifyPaymeAuth)
 *
 * Test mode (CLICK_TEST_MODE / PAYME_TEST_MODE = true): "Tekshirish"
 * button auto-marks the payment as paid without hitting the provider —
 * lets you develop without merchant credentials.
 */
export class PaymentService {
  constructor(private readonly payments: PaymentRepository) {}

  async createPayment(
    userId: number,
    provider: PaymentProvider,
  ): Promise<CreatePaymentResult> {
    const merchantTransId = `raport_${Date.now()}_${crypto
      .randomBytes(4)
      .toString('hex')}`;

    const record = await this.payments.create({
      userId,
      amount: config.payment.amount,
      merchantTransId,
      provider,
      meta: { provider },
    });

    const url =
      provider === 'click'
        ? this.buildClickUrl(merchantTransId, config.payment.amount)
        : this.buildPaymeUrl(merchantTransId, config.payment.amount);

    logger.info(
      { paymentId: record.id, merchantTransId, provider, url },
      'Payment created',
    );

    return {
      paymentId: record.id,
      merchantTransId,
      amount: config.payment.amount,
      provider,
      paymentUrl: url,
    };
  }

  /** Builds Click's hosted-payment URL. */
  buildClickUrl(merchantTransId: string, amount: number): string {
    const base = 'https://my.click.uz/services/pay';
    const params = new URLSearchParams({
      service_id: config.click.serviceId,
      merchant_id: config.click.merchantId,
      amount: amount.toString(),
      transaction_param: merchantTransId,
      return_url: config.click.returnUrl,
    });
    return `${base}?${params.toString()}`;
  }

  /**
   * Payme uses a base64-encoded semicolon-separated parameter string:
   *   m=<MERCHANT_ID>;ac.<param>=<value>;a=<amount_in_tiyin>;c=<return_url>
   * Amount must be in tiyin (1 sum = 100 tiyin).
   */
  buildPaymeUrl(merchantTransId: string, amountSum: number): string {
    const amountTiyin = amountSum * 100;
    const parts = [
      `m=${config.payme.merchantId}`,
      `ac.order_id=${merchantTransId}`,
      `a=${amountTiyin}`,
    ];
    if (config.payme.returnUrl) parts.push(`c=${config.payme.returnUrl}`);
    const encoded = Buffer.from(parts.join(';'), 'utf8').toString('base64');
    return `https://checkout.paycom.uz/${encoded}`;
  }

  /**
   * Click signature for incoming webhook (Action 0: Prepare, 1: Complete).
   *   sign = md5(click_trans_id + service_id + SECRET_KEY +
   *              merchant_trans_id + [merchant_prepare_id +] amount +
   *              action + sign_time)
   */
  verifyClickSignature(params: {
    clickTransId: string;
    serviceId: string;
    merchantTransId: string;
    merchantPrepareId?: string;
    amount: string;
    action: string;
    signTime: string;
    signString: string;
  }): boolean {
    if (config.click.testMode) return true;
    const expected = crypto
      .createHash('md5')
      .update(
        params.clickTransId +
          params.serviceId +
          config.click.secretKey +
          params.merchantTransId +
          (params.merchantPrepareId ?? '') +
          params.amount +
          params.action +
          params.signTime,
      )
      .digest('hex');
    const ok = expected === params.signString;
    if (!ok) {
      logger.warn(
        { expected, got: params.signString },
        'Click signature mismatch',
      );
    }
    return ok;
  }

  /** Backward-compat alias (was named verifySignature). */
  verifySignature = this.verifyClickSignature.bind(this);

  /**
   * Payme webhook auth: HTTP Basic "Paycom:<PAYME_KEY>".
   * The Authorization header arrives as "Basic <base64>".
   */
  verifyPaymeAuth(authHeader: string | undefined): boolean {
    if (config.payme.testMode) return true;
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [login, password] = decoded.split(':');
    return login === 'Paycom' && password === config.payme.key;
  }

  async markPaid(
    merchantTransId: string,
    providerTransId?: string,
  ): Promise<number | null> {
    const p = await this.payments.findByMerchantTransId(merchantTransId);
    if (!p) return null;
    if (p.status === 'paid') return p.userId;
    await this.payments.markPaid(p.id, providerTransId);
    return p.userId;
  }

  async markFailed(merchantTransId: string, note?: string): Promise<void> {
    const p = await this.payments.findByMerchantTransId(merchantTransId);
    if (p) await this.payments.markFailed(p.id, note);
  }

  /** Returns the payment record (used by Payme webhook for amount checks). */
  async findByMerchantTransId(merchantTransId: string) {
    return this.payments.findByMerchantTransId(merchantTransId);
  }

  /** Manual check from the bot — used by "🔍 Tekshirish" button. */
  async checkAndMaybeFinalize(
    paymentId: number,
  ): Promise<'paid' | 'pending' | 'failed'> {
    const p = await this.payments.findById(paymentId);
    if (!p) return 'failed';
    if (p.status === 'paid') return 'paid';
    const provider = (p.provider as PaymentProvider) ?? 'click';
    const inTestMode =
      provider === 'payme' ? config.payme.testMode : config.click.testMode;
    if (inTestMode) {
      await this.payments.markPaid(p.id, 'test-mode');
      return 'paid';
    }
    return 'pending';
  }
}
