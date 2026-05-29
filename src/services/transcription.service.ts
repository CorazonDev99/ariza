import { logger } from '../utils/logger';
import type { Locale } from '../i18n';

// OpenAI Whisper hard caps the audio at 25 MiB. Telegram voice messages
// are typically <1 MiB so this is just a safety net.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Whisper takes ISO-639-1 hints. Our two Uzbek locales both map to 'uz'
// — Whisper outputs text in the original spoken language; we don't ask
// it to re-script Cyrillic ↔ Latin here.
const LOCALE_TO_WHISPER_LANG: Record<Locale, string> = {
  uz_cyrillic: 'uz',
  uz_latin: 'uz',
  ru: 'ru',
};

export interface TranscribeInput {
  audio: Buffer;
  /** MIME type as advertised by Telegram, e.g. 'audio/ogg'. */
  mimeType: string;
  /** Original filename hint. Whisper uses the extension to pick a decoder. */
  filename: string;
  locale: Locale;
  /**
   * Optional vocabulary / style hint passed to Whisper as the `prompt`
   * parameter. Up to ~244 tokens. Should match the audio language. Use
   * it to anchor recognition of common Uzbek names, addresses, and
   * legal vocabulary that whisper-1 / whisper-large-v3 otherwise mangle.
   * See https://platform.openai.com/docs/guides/speech-to-text/prompting
   */
  prompt?: string;
}

/**
 * Wraps OpenAI Whisper for short voice messages collected inside the
 * wizard. Returns plain transcribed text or throws — the caller is
 * expected to push the text through the same field-validation pipe as
 * a typed message, so errors propagate as a localized error reply.
 */
export class TranscriptionService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    apiKey: string,
    baseUrl = 'https://api.openai.com/v1',
    model = 'whisper-1',
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  isEnabled(): boolean {
    return this.apiKey !== '';
  }

  /** Provider hostname extracted from baseUrl — used only for logging
   *  so you can tell at a glance which Whisper service answered. */
  private provider(): string {
    try {
      return new URL(this.baseUrl).hostname;
    } catch {
      return this.baseUrl;
    }
  }

  async transcribe(input: TranscribeInput): Promise<string> {
    if (!this.apiKey) throw new Error('Transcription is not configured');
    if (input.audio.length > MAX_AUDIO_BYTES) {
      throw new Error('audio_too_large');
    }

    // Node 20+ ships native FormData / Blob / fetch — no extra deps needed.
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      input.filename,
    );
    form.append('model', this.model);
    form.append('language', LOCALE_TO_WHISPER_LANG[input.locale]);
    form.append('response_format', 'json');
    // Whisper supports a free-text `prompt` that anchors the vocabulary.
    // We pass it for fields like FIO / address where Uzbek names get
    // mangled by default. Capped at 800 chars for safety (the model
    // truncates to ~244 tokens anyway). Empty / undefined → skip.
    if (input.prompt && input.prompt.trim()) {
      form.append('prompt', input.prompt.slice(0, 800));
    }

    const url = `${this.baseUrl}/audio/transcriptions`;
    const startedAt = Date.now();
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (err) {
      logger.error({ err, provider: this.provider() }, 'Whisper network failure');
      throw err instanceof Error ? err : new Error('whisper_network');
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.error(
        {
          status: resp.status,
          provider: this.provider(),
          body: body.slice(0, 300),
        },
        'Whisper API non-2xx',
      );
      throw new Error(`whisper_http_${resp.status}`);
    }

    const data = (await resp.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    logger.info(
      {
        provider: this.provider(),
        model: this.model,
        locale: input.locale,
        bytes: input.audio.length,
        ms: Date.now() - startedAt,
        chars: text.length,
      },
      'Whisper transcription done',
    );
    if (!text) throw new Error('whisper_empty');
    return text;
  }
}
