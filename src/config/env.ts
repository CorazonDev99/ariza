import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(10, 'BOT_TOKEN is required'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  DATABASE_URL: z.string().min(1),
  TEMPLATES_DIR: z.string().default('./templates'),
  OUTPUT_DIR: z.string().default('./generated'),
  LIBREOFFICE_BIN: z.string().default('libreoffice'),

  // Payment.
  // PAYMENT_ENABLED=false (default) hides the entire pay flow: provider
  // picker, Click/Payme buttons, "Pay X soʻm" prompts — and the document
  // is sent immediately after preview confirmation. Flip to true once
  // the audience is built and monetisation is ready.
  PAYMENT_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  PAYMENT_AMOUNT: z.coerce.number().int().positive().default(1500),
  PAYMENT_WEBHOOK_PORT: z.coerce.number().int().positive().default(3000),
  CLICK_TEST_MODE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  CLICK_SERVICE_ID: z.string().default(''),
  CLICK_MERCHANT_ID: z.string().default(''),
  CLICK_SECRET_KEY: z.string().default(''),
  CLICK_RETURN_URL: z.string().default('https://t.me/'),

  // Payme (Paycom) credentials.
  // Test mode shares the same flag as Click so devs can pay-by-button locally.
  PAYME_TEST_MODE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  PAYME_MERCHANT_ID: z.string().default(''),
  PAYME_KEY: z.string().default(''),
  PAYME_RETURN_URL: z.string().default('https://t.me/'),

  // QR / public download
  // If PUBLIC_BASE_URL is set, the QR points to <PUBLIC_BASE_URL>/download/<token>
  // (the same HTTP server that handles Click webhooks).
  // Otherwise the QR points to https://t.me/<BOT_USERNAME>?start=doc_<token>
  // which works without any public infrastructure.
  PUBLIC_BASE_URL: z.string().default(''),
  BOT_USERNAME: z.string().default(''),

  // Display name shown next to the bot in Telegram clients. Pushed to
  // Telegram via setMyName on startup (idempotent — safe to restart).
  BOT_DISPLAY_NAME: z.string().default('ArizaPro'),

  // Support contact: Telegram username (with or without leading "@").
  // Used by the "Bot haqida" → "Қўллаб-қувватлаш" inline button as
  //   https://t.me/<username>
  SUPPORT_CONTACT: z.string().default(''),

  // Comma-separated Telegram user IDs allowed into the /admin panel.
  // Example: ADMIN_CHAT_IDS=123456789,987654321
  ADMIN_CHAT_IDS: z.string().default(''),

  // Anthropic API key for the in-wizard AI rewrite button on free-form
  // fields (e.g. objection_reasons). When empty the AI button is hidden.
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  // OpenAI-COMPATIBLE Whisper endpoint for voice-to-text on free-form
  // text fields. Works with any provider that exposes the OpenAI Audio
  // Transcriptions API at <BASE>/audio/transcriptions:
  //   - OpenAI:    BASE=https://api.openai.com/v1     MODEL=whisper-1
  //   - Groq:      BASE=https://api.groq.com/openai/v1 MODEL=whisper-large-v3
  //                (free tier — recommended)
  //   - DeepInfra: BASE=https://api.deepinfra.com/v1/openai
  // Empty API key disables the feature.
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z
    .string()
    .default('https://api.openai.com/v1')
    .transform((s) => s.replace(/\/+$/, '')),
  OPENAI_TRANSCRIBE_MODEL: z.string().default('whisper-1'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = parsed.data;
