import { Scenes, Telegraf, session } from 'telegraf';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../repositories/prisma';
import { UserRepository } from '../repositories/user.repository';
import { TemplateRepository } from '../repositories/template.repository';
import { DraftRepository } from '../repositories/draft.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { ProfileRepository } from '../repositories/profile.repository';
import { TemplateService } from '../services/template.service';
import { DocxService } from '../services/docx.service';
import { PdfService } from '../services/pdf.service';
import { DocumentService } from '../services/document.service';
import { PaymentService } from '../services/payment.service';
import { BroadcastService } from '../services/broadcast.service';
import { AiAssistService } from '../services/ai-assist.service';
import { TranscriptionService } from '../services/transcription.service';
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
  /** Bundled here so the Mini App HTTP layer can reuse the same
   *  long-lived service instances as the bot. */
  webappServices: {
    users: UserRepository;
    drafts: DraftRepository;
    documents: DocumentRepository;
    templateRepo: TemplateRepository;
    documentService: DocumentService;
    aiAssist: AiAssistService;
    transcription: TranscriptionService;
    profiles: ProfileRepository;
  };
}

export function createBot(): BotBundle {
  const userRepo = new UserRepository(prisma);
  const templateRepo = new TemplateRepository(prisma);
  const draftRepo = new DraftRepository(prisma);
  const documentRepo = new DocumentRepository(prisma);
  const paymentRepo = new PaymentRepository(prisma);
  const profileRepo = new ProfileRepository(prisma);

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
  const aiAssist = new AiAssistService(
    config.ai.apiKey,
    config.ai.model,
    config.ai.openaiKey,
    config.ai.openaiBaseUrl,
    config.ai.openaiModel,
    config.ai.openaiVisionModel,
  );
  if (aiAssist.isEnabled()) {
    logger.info({ model: config.ai.model }, 'AI-assist enabled');
  }
  const transcription = new TranscriptionService(
    config.transcribe.apiKey,
    config.transcribe.baseUrl,
    config.transcribe.model,
  );
  if (transcription.isEnabled()) {
    logger.info(
      { baseUrl: config.transcribe.baseUrl, model: config.transcribe.model },
      'Voice transcription enabled',
    );
  }

  const bot = new Telegraf<BotContext>(config.botToken);

  bot.use(session());
  bot.use(errorBoundary());
  bot.use(loggerMiddleware());
  bot.use(userMiddleware(userRepo));

  const broadcastService = new BroadcastService(bot, adminRepo);

  const arizaScene = buildArizaWizardScene({
    templateRepo,
    documentRepo,
    documentService,
    draftRepo,
    paymentService,
    aiAssist,
    transcription,
    profiles: profileRepo,
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
    aiAssist,
  });
  registerAdmin(bot, { admin: adminRepo });

  bot.catch((err, ctx) => {
    // Telegram returns 400 "message is not modified" whenever the user
    // double-clicks the same inline button and the second click tries
    // to editMessageText to the IDENTICAL text/markup. The first edit
    // already put the message in the desired state — there's nothing
    // to fix, so swallow it silently. Logging at debug keeps a trace
    // for diagnostics without polluting prod logs.
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && /message is not modified/i.test(msg)) {
      logger.debug({ msg }, 'Telegram edit no-op (double click)');
      return;
    }
    logger.error({ err, update: ctx.update }, 'Telegraf top-level error');
  });

  return {
    bot,
    paymentService,
    userRepo,
    webappServices: {
      users: userRepo,
      drafts: draftRepo,
      documents: documentRepo,
      templateRepo,
      documentService,
      aiAssist,
      transcription,
      profiles: profileRepo,
    },
  };
}
