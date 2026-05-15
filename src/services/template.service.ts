import type { Template } from '@prisma/client';
import type { TemplateRepository } from '../repositories/template.repository';
import { TemplateNotFoundError } from '../utils/errors';

export class TemplateService {
  constructor(private readonly templates: TemplateRepository) {}

  list(): Promise<Template[]> {
    return this.templates.listActive();
  }

  async getByIdOrThrow(id: number): Promise<Template> {
    const t = await this.templates.findById(id);
    if (!t) throw new TemplateNotFoundError(`Template ${id} not found`);
    return t;
  }
}
