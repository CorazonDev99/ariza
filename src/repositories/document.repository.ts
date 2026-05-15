import type { Document, PrismaClient } from '@prisma/client';
import type { DocumentFormat } from '../types';
import type { Locale } from '../i18n';

export interface CreateDocumentInput {
  userId: number;
  templateId: number;
  format: DocumentFormat;
  filePath: string;
  language: Locale;
  paymentId?: number;
  downloadToken?: string;
}

export class DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateDocumentInput): Promise<Document> {
    return this.prisma.document.create({
      data: {
        userId: input.userId,
        templateId: input.templateId,
        format: input.format,
        filePath: input.filePath,
        language: input.language,
        paymentId: input.paymentId,
        downloadToken: input.downloadToken,
      },
    });
  }

  listByUser(userId: number, limit = 10): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findByToken(token: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { downloadToken: token } });
  }

  countTotal(): Promise<number> {
    return this.prisma.document.count();
  }

  countUniqueUsers(): Promise<number> {
    return this.prisma.document
      .findMany({ distinct: ['userId'], select: { userId: true } })
      .then((rows) => rows.length);
  }
}
