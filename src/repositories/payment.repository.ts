import type { Payment, PrismaClient } from '@prisma/client';

export interface CreatePaymentInput {
  userId: number;
  amount: number;
  merchantTransId: string;
  provider: 'click' | 'payme';
  meta?: Record<string, unknown>;
}

export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreatePaymentInput): Promise<Payment> {
    return this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        merchantTransId: input.merchantTransId,
        provider: input.provider,
        meta: JSON.stringify(input.meta ?? {}),
      },
    });
  }

  findById(id: number): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  findByMerchantTransId(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { merchantTransId: id } });
  }

  async markPaid(id: number, providerTransId?: string): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        providerTransId: providerTransId ?? null,
      },
    });
  }

  async markFailed(id: number, note?: string): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status: 'failed',
        meta: JSON.stringify({ failureNote: note }),
      },
    });
  }
}
