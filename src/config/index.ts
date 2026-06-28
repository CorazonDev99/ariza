import path from 'node:path';
import { env } from './env';

export interface AppConfig {
  botToken: string;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: string;
  templatesDir: string;
  outputDir: string;
  /** Hours to keep files in outputDir before the hourly cleanup deletes
   *  them. 0 disables cleanup. */
  generatedRetentionHours: number;
  libreofficeBin: string;
  payment: {
    /** When false, the wizard skips the provider picker and pay
     *  buttons and sends the PDF straight after preview confirmation.
     *  Existing payment handlers stay registered (no-op) so re-enabling
     *  is a single env flip with no code change. */
    enabled: boolean;
    amount: number;
    webhookPort: number;
  };
  click: {
    testMode: boolean;
    serviceId: string;
    merchantId: string;
    secretKey: string;
    returnUrl: string;
  };
  payme: {
    testMode: boolean;
    merchantId: string;
    key: string;
    returnUrl: string;
  };
  publicBaseUrl: string;
  botUsername: string;
  /** Public HTTPS URL where the Telegram Mini App is hosted (Cloudflare
   *  Tunnel hostname or your own domain + `/webapp`). Empty disables
   *  the Mini App button in the main menu. */
  webappUrl: string;
  /** Display name pushed via setMyName at startup. */
  botDisplayName: string;
  /** Telegram username for the support button (no leading "@"), or "". */
  supportContact: string;
  /** Public Telegram channel URL for the "Каналга ўтиш" button, or "". */
  channelUrl: string;
  /** Telegram user IDs allowed into the admin panel. */
  adminChatIds: number[];
  /** Chat ID of the group that receives feedback / suggestions. Empty
   *  string disables the feedback button. */
  feedbackGroupId: string;
  ai: {
    /** Anthropic key. When empty, the Anthropic backend is disabled. */
    apiKey: string;
    model: string;
    /** OpenAI-compatible chat backend (e.g. Groq) for «AI-Yurist».
     *  Reuses the transcription key/baseUrl. When openaiKey is set,
     *  AI-Yurist prefers it over Anthropic. */
    openaiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;
    /** Multimodal model for the 📸 document scanner. Empty disables it. */
    openaiVisionModel: string;
  };
  transcribe: {
    /** When empty, voice messages in the wizard are silently ignored. */
    apiKey: string;
    /** Base URL of an OpenAI-compatible Audio API. */
    baseUrl: string;
    model: string;
  };
}

export const config: AppConfig = {
  botToken: env.BOT_TOKEN,
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  templatesDir: path.resolve(env.TEMPLATES_DIR),
  outputDir: path.resolve(env.OUTPUT_DIR),
  generatedRetentionHours: env.GENERATED_RETENTION_HOURS,
  libreofficeBin: env.LIBREOFFICE_BIN,
  payment: {
    enabled: env.PAYMENT_ENABLED,
    amount: env.PAYMENT_AMOUNT,
    webhookPort: env.PAYMENT_WEBHOOK_PORT,
  },
  click: {
    testMode: env.CLICK_TEST_MODE,
    serviceId: env.CLICK_SERVICE_ID,
    merchantId: env.CLICK_MERCHANT_ID,
    secretKey: env.CLICK_SECRET_KEY,
    returnUrl: env.CLICK_RETURN_URL,
  },
  payme: {
    testMode: env.PAYME_TEST_MODE,
    merchantId: env.PAYME_MERCHANT_ID,
    key: env.PAYME_KEY,
    returnUrl: env.PAYME_RETURN_URL,
  },
  publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ''),
  botUsername: env.BOT_USERNAME,
  webappUrl: env.WEBAPP_URL.replace(/\/+$/, ''),
  botDisplayName: env.BOT_DISPLAY_NAME,
  supportContact: env.SUPPORT_CONTACT.trim().replace(/^@/, ''),
  channelUrl: env.CHANNEL_URL.trim(),
  adminChatIds: env.ADMIN_CHAT_IDS.split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map((s) => Number(s)),
  feedbackGroupId: env.FEEDBACK_GROUP_ID.trim(),
  ai: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    openaiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    openaiModel: env.OPENAI_CHAT_MODEL,
    openaiVisionModel: env.OPENAI_VISION_MODEL,
  },
  transcribe: {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TRANSCRIBE_MODEL,
  },
};
