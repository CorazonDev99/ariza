import type { PrismaClient, Template } from '@prisma/client';

export interface UpsertTemplateInput {
  code: string;
  category?: string;
  title: string;
  subtitle?: string;
  description?: string;
  filePath: string;
  active?: boolean;
}

export class TemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listActive(): Promise<Template[]> {
    return this.prisma.template.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });
  }

  findById(id: number): Promise<Template | null> {
    return this.prisma.template.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<Template | null> {
    return this.prisma.template.findUnique({ where: { code } });
  }

  upsert(input: UpsertTemplateInput): Promise<Template> {
    const update = {
      category: input.category ?? 'ariza',
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      filePath: input.filePath,
      active: input.active ?? true,
    };
    return this.prisma.template.upsert({
      where: { code: input.code },
      update,
      create: { code: input.code, ...update },
    });
  }
}
