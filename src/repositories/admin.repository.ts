import type { Payment, PrismaClient, User } from '@prisma/client';

/** Time window for dashboard filters. */
export type StatsPeriod = 'day' | 'week' | 'month' | 'all';

export interface PeriodStats {
  period: StatsPeriod;
  /** Inclusive lower bound, or null for 'all'. */
  from: Date | null;
  /** Inclusive upper bound (now). */
  to: Date;
  newUsers: number;
  documents: number;
  payments: {
    paidCount: number;
    paidSum: number;
    pending: number;
    failed: number;
    cancelled: number;
  };
  topTemplates: Array<{ code: string; title: string; count: number }>;
  byLanguage: Array<{ language: string; count: number }>;
}

export interface PaymentRow {
  id: number;
  status: string;
  amount: number;
  createdAt: Date;
  paidAt: Date | null;
  user: {
    id: number;
    telegramId: bigint;
    username: string | null;
    firstName: string | null;
  };
}

/** Full payment shape used in XLSX export — all auditable fields. */
export interface PaymentExportRow {
  id: number;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  provider: string;
  amount: number;
  merchantTransId: string;
  providerTransId: string | null;
  userId: number;
  telegramId: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** Resolves the lower-bound Date for a given period, or null for "all". */
export function periodStart(period: StatsPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0); // beginning of "today" in local time
  if (period === 'day') return start;
  if (period === 'week') {
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (period === 'month') {
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  return null;
}

export class AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Aggregate everything the dashboard needs for one period. */
  async stats(period: StatsPeriod): Promise<PeriodStats> {
    const to = new Date();
    const from = periodStart(period, to);
    const createdAtFilter = from ? { gte: from, lte: to } : undefined;

    const [
      newUsers,
      documents,
      paidAgg,
      pending,
      failed,
      cancelled,
      docsByTemplate,
      usersByLang,
    ] = await Promise.all([
      this.prisma.user.count({
        where: createdAtFilter ? { createdAt: createdAtFilter } : {},
      }),
      this.prisma.document.count({
        where: createdAtFilter ? { createdAt: createdAtFilter } : {},
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          ...(createdAtFilter ? { paidAt: createdAtFilter } : {}),
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: {
          status: 'pending',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: 'failed',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: 'cancelled',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
      }),
      this.prisma.document.groupBy({
        by: ['templateId'],
        where: createdAtFilter ? { createdAt: createdAtFilter } : {},
        _count: { _all: true },
        orderBy: { _count: { templateId: 'desc' } },
        take: 5,
      }),
      this.prisma.user.groupBy({
        by: ['language'],
        where: createdAtFilter ? { createdAt: createdAtFilter } : {},
        _count: { _all: true },
        orderBy: { _count: { language: 'desc' } },
      }),
    ]);

    const templateIds = docsByTemplate.map((g) => g.templateId);
    const templates = templateIds.length
      ? await this.prisma.template.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, code: true, title: true },
        })
      : [];
    const tplById = new Map(templates.map((t) => [t.id, t]));

    return {
      period,
      from,
      to,
      newUsers,
      documents,
      payments: {
        paidCount: paidAgg._count._all,
        paidSum: paidAgg._sum.amount ?? 0,
        pending,
        failed,
        cancelled,
      },
      topTemplates: docsByTemplate.map((g) => ({
        code: tplById.get(g.templateId)?.code ?? `#${g.templateId}`,
        title: tplById.get(g.templateId)?.title ?? '—',
        count: g._count._all,
      })),
      byLanguage: usersByLang.map((g) => ({
        language: g.language,
        count: g._count._all,
      })),
    };
  }

  /** Last N payments in a period, newest first, with user info. */
  async recentPayments(
    period: StatsPeriod,
    take = 20,
  ): Promise<PaymentRow[]> {
    const from = periodStart(period);
    const rows = await this.prisma.payment.findMany({
      where: from ? { createdAt: { gte: from } } : {},
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
          },
        },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      status: p.status,
      amount: p.amount,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      user: p.user,
    }));
  }

  /**
   * Full payments dataset for XLSX export. Capped at 10 000 rows (Telegram
   * tolerates much larger documents, but xlsx generation gets slow above
   * that for in-memory builds — fine for our scale).
   */
  async paymentsForExport(period: StatsPeriod): Promise<PaymentExportRow[]> {
    const from = periodStart(period);
    const rows = await this.prisma.payment.findMany({
      where: from ? { createdAt: { gte: from } } : {},
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      status: p.status,
      provider: p.provider,
      amount: p.amount,
      merchantTransId: p.merchantTransId,
      providerTransId: p.providerTransId,
      userId: p.user.id,
      telegramId: p.user.telegramId,
      username: p.user.username,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
    }));
  }

  /** All users, used as broadcast recipient list. */
  async allUsersForBroadcast(): Promise<Pick<User, 'id' | 'telegramId' | 'language'>[]> {
    return this.prisma.user.findMany({
      select: { id: true, telegramId: true, language: true },
    });
  }

  /** Convenience: total user count, used for the broadcast preview. */
  async userCount(): Promise<number> {
    return this.prisma.user.count();
  }
}

export type AdminPayment = Payment;
