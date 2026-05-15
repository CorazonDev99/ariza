import type { Draft, PrismaClient } from '@prisma/client';
import type { WizardState } from '../types';

export class DraftRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(userId: number): Promise<Draft> {
    const existing = await this.prisma.draft.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.draft.create({
      data: { userId, step: 'start', payload: '{}' },
    });
  }

  async save(
    draftId: number,
    state: WizardState,
  ): Promise<Draft> {
    return this.prisma.draft.update({
      where: { id: draftId },
      data: {
        templateId: state.templateDbId,
        step: state.status,
        payload: JSON.stringify(state),
      },
    });
  }

  async reset(userId: number): Promise<void> {
    await this.prisma.draft.deleteMany({ where: { userId } });
  }

  parseState(draft: Draft): WizardState | null {
    try {
      const parsed = JSON.parse(draft.payload) as WizardState;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
