import { Scenes, Telegraf, session } from 'telegraf';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../repositories/prisma';
import { UserRepository } from '../repositories/user.repository';
import { TemplateRepository } from '../repositories/template.repository';
import { DraftRepository } from '../repositories/draft.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { TemplateService } from '../services/template.service';
import { DocxService } from '../services/docx.service';
import { PdfService } from '../services/pdf.service';
import { DocumentService } from '../services/document.service';
import { PaymentService } from '../services/payment.service';
import { BroadcastService } from '../services/broadcast.service';
import { AiAssistService } from '../services/ai-assist.service';
import { AdminRepository } from '../repositories/admin.repository';
import { buildArizaWizardScene, buildBroadcastScene } from '../scenes';
import { registerCommands } from './commands';
import { registerAdmin } from './admin';
import {
  errorBoundary,
  loggerMiddleware,
  userMiddleware,
} from './middleware';
import type { BotContext } from './context';

export interface BotBundle {
  bot: Telegraf<BotContext>;
  paymentService: PaymentService;
  userRepo: UserRepository;
}

export function createBot(): BotBundle {
  const userRepo = new UserRepository(prisma);
  const templateRepo = new TemplateRepository(prisma);
  const draftRepo = new DraftRepository(prisma);
  const documentRepo = new DocumentRepository(prisma);
  const paymentRepo = new PaymentRepository(prisma);

  const templateService = new TemplateService(templateRepo);
  const docxService = new DocxService();
  const pdfService = new PdfService();
  const documentService = new DocumentService(
    templateService,
    docxService,
    pdfService,
    documentRepo,
  );
  const paymentService = new PaymentService(paymentRepo);
  const adminRepo = new AdminRepository(prisma);
  const aiAssist = new AiAssistService(config.ai.apiKey, config.ai.model);
  if (aiAssist.isEnabled()) {
    logger.info({ model: config.ai.model }, 'AI-assist enabled');
  }

  const bot = new Telegraf<BotContext>(config.botToken);

  bot.use(session());
  bot.use(errorBoundary());
  bot.use(loggerMiddleware());
  bot.use(userMiddleware(userRepo));

  const broadcastService = new BroadcastService(bot, adminRepo);

  const arizaScene = buildArizaWizardScene({
    templateRepo,
    documentService,
    draftRepo,
    paymentService,
    aiAssist,
  });
  const broadcastScene = buildBroadcastScene({
    broadcast: broadcastService,
    admin: adminRepo,
  });

  const stage = new Scenes.Stage<BotContext>([arizaScene, broadcastScene]);
  bot.use(stage.middleware());

  registerCommands(bot, {
    documents: documentRepo,
    drafts: draftRepo,
    users: userRepo,
  });
  registerAdmin(bot, { admin: adminRepo });

  bot.catch((err, ctx) => {
    logger.error({ err, update: ctx.update }, 'Telegraf top-level error');
  });

  return { bot, paymentService, userRepo };
}
