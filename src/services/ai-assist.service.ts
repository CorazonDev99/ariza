import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import type { Locale } from '../i18n';

const LOCALE_LABEL: Record<Locale, string> = {
  uz_cyrillic: 'Узбекский (кириллица)',
  uz_latin: "O'zbek (lotin)",
  ru: 'Русский',
};

const SYSTEM_PROMPT = `Ты — помощник по составлению официальных судебных заявлений (Узбекистан).
Тебе дают черновик одного абзаца (обычно «причины возражения», обстоятельства дела или мотивировка).
Перепиши его в деловом, юридически корректном стиле:
— сохрани все ФАКТЫ из черновика и НЕ выдумывай новых;
— убери эмоции, разговорные обороты, мат, обращения от первого лица к судье;
— используй официальный канцелярский тон, краткие связные предложения;
— оставь ту же фактическую длину (не растягивай искусственно);
— верни ТОЛЬКО переписанный текст, без вступления, без markdown, без кавычек.
ВАЖНО: пиши на том же языке, что и черновик. Если язык непонятен — пиши на языке, указанном пользователем.`;

export class AiAssistService {
  private client: Anthropic | null;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async rewriteLegalText(original: string, locale: Locale): Promise<string> {
    if (!this.client) throw new Error('AI assist is not configured');

    const trimmed = original.trim();
    // Hard caps to keep both cost and prompt-injection surface small.
    const bounded = trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;

    const userMsg =
      `Язык черновика: ${LOCALE_LABEL[locale]}.\n\n` +
      `Черновик пользователя:\n"""\n${bounded}\n"""\n\n` +
      `Перепиши в официальном юридическом стиле на том же языке.`;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const block = resp.content.find((c) => c.type === 'text');
      const text = block && block.type === 'text' ? block.text.trim() : '';
      if (!text) throw new Error('empty response');
      // Strip wrapping quotes the model sometimes adds despite the prompt.
      return stripWrappingQuotes(text);
    } catch (err) {
      logger.error({ err }, 'AI rewrite failed');
      throw err instanceof Error ? err : new Error('AI rewrite failed');
    }
  }
}

function stripWrappingQuotes(s: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['«', '»'],
    ['“', '”'],
  ];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close)) {
      return s.slice(open.length, s.length - close.length).trim();
    }
  }
  return s;
}
