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

const YURIST_SYSTEM_PROMPT = `Ты — «AI-Yurist», юридический помощник для граждан Узбекистана. Отвечаешь на бытовые правовые вопросы простым, понятным языком, опираясь на законодательство Республики Узбекистан.

Правила ответа:
— Пиши на языке, указанном пользователем (узбекский кириллица / o'zbek lotin / русский).
— Структура: 1) коротко — какие у человека права в этой ситуации; 2) что делать по шагам; 3) какой документ нужен и куда обращаться (суд / орган / организация).
— Если ситуации подходит готовый документ (ариза, жалоба, иск, возражение, ходатайство) — отдельной строкой подскажи, что его можно сразу сформировать в этом боте через кнопку «📄 Ariza topshirish».
— Не выдумывай номера статей и точные нормы, если не уверен — объясняй общими принципами.
— Без markdown, без **жирного**: обычный текст, можно «•» и эмодзи. Коротко и по делу, без воды, максимум ~250 слов.
— Не давай гарантий исхода. По сложным или уголовным делам советуй обратиться к адвокату.
— Если вопрос не юридический — мягко скажи, что помогаешь только с правовыми вопросами.`;

export class AiAssistService {
  private client: Anthropic | null;
  private model: string;
  private openaiKey: string;
  private openaiBaseUrl: string;
  private openaiModel: string;

  constructor(
    apiKey: string,
    model: string,
    openaiKey = '',
    openaiBaseUrl = '',
    openaiModel = '',
  ) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = model;
    this.openaiKey = openaiKey;
    this.openaiBaseUrl = openaiBaseUrl.replace(/\/+$/, '');
    this.openaiModel = openaiModel;
  }

  /** Anthropic-backed features (the in-wizard rewrite button). */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /** AI-Yurist works on either backend — OpenAI-compatible (Groq) or
   *  Anthropic. Preference is given to the OpenAI-compatible one. */
  canAnswerQuestions(): boolean {
    return Boolean(this.openaiKey) || this.client !== null;
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

  /**
   * AI-Yurist: answer a free-form legal question from a citizen, in the
   * user's locale. Returns plain text (no markdown) suitable for a
   * Telegram message sent WITHOUT parse_mode.
   */
  async askLegalQuestion(question: string, locale: Locale): Promise<string> {
    const trimmed = question.trim();
    const bounded = trimmed.length > 1500 ? trimmed.slice(0, 1500) : trimmed;
    const userMsg =
      `Язык ответа: ${LOCALE_LABEL[locale]}.\n\n` +
      `Вопрос пользователя:\n"""\n${bounded}\n"""`;

    try {
      // Prefer the OpenAI-compatible backend (Groq) — free and reachable.
      if (this.openaiKey) return await this.askViaOpenAI(userMsg);
      if (this.client) return await this.askViaAnthropic(userMsg);
      throw new Error('AI assist is not configured');
    } catch (err) {
      logger.error({ err }, 'AI-Yurist question failed');
      throw err instanceof Error ? err : new Error('AI-Yurist failed');
    }
  }

  private async askViaAnthropic(userMsg: string): Promise<string> {
    const resp = await this.client!.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: YURIST_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });
    const block = resp.content.find((c) => c.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    if (!text) throw new Error('empty response');
    return text;
  }

  /** OpenAI-compatible /chat/completions (Groq, OpenAI, DeepInfra, …).
   *  Uses native fetch — no SDK, same approach as the transcription
   *  service. */
  private async askViaOpenAI(userMsg: string): Promise<string> {
    const resp = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: YURIST_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`chat ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return text;
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
