import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getTg } from '../tg';
import { t } from '../i18n';
import { useBackTo } from '../App';
import type { PageCtx } from '../App';
import { IconSend, IconSparkles } from '../components/icons';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

export function AiYuristPage(ctx: PageCtx) {
  useBackTo('/');
  getTg().MainButton.hide();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    getTg().HapticFeedback.impactOccurred('light');
    const userMsg: Msg = { id: idRef.current++, role: 'user', text: q };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const { answer } = await api.aiYurist(q, ctx.locale);
      setMessages((m) => [
        ...m,
        { id: idRef.current++, role: 'assistant', text: answer },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: 'assistant',
          text: t(ctx.locale, 'aiyurist.error'),
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;
  const examples = [
    t(ctx.locale, 'aiyurist.ex1'),
    t(ctx.locale, 'aiyurist.ex2'),
    t(ctx.locale, 'aiyurist.ex3'),
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="reveal flex items-center gap-3 px-4 pt-5 pb-3 safe-top">
        <div className="shrink-0 w-11 h-11 rounded-2xl brand-bg grid place-items-center text-white ring-accent">
          <IconSparkles className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[19px] font-extrabold tracking-tight text-tg-text leading-tight">
            {t(ctx.locale, 'aiyurist.title')}
          </h1>
          <p className="text-[12px] text-tg-subtitle leading-snug truncate">
            {t(ctx.locale, 'aiyurist.subtitle')}
          </p>
        </div>
      </header>

      {/* ── Messages ───────────────────────────────────────────── */}
      <main className="flex-1 px-4 pb-2 space-y-2.5">
        {empty && (
          <div className="reveal pt-2">
            <div className="card rounded-[20px] rounded-tl-md p-3.5 max-w-[88%]">
              <p className="text-[14px] leading-relaxed text-tg-text whitespace-pre-wrap">
                {t(ctx.locale, 'aiyurist.intro')}
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => send(ex)}
                  className="press reveal self-start text-left text-[13px] font-medium text-tg-text rounded-2xl px-3.5 py-2.5 bg-tg-text/[0.05] border border-tg-text/[0.06] active:bg-tg-text/[0.08]"
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="reveal flex justify-end">
              <div className="brand-bg text-white rounded-[20px] rounded-br-md px-3.5 py-2.5 max-w-[85%] shadow-sm">
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="reveal flex justify-start">
              <div
                className={`card rounded-[20px] rounded-tl-md px-3.5 py-2.5 max-w-[88%] ${
                  msg.error ? 'text-tg-destructive' : 'text-tg-text'
                }`}
              >
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex justify-start">
            <div className="card rounded-[20px] rounded-tl-md px-4 py-3 inline-flex items-center gap-1.5">
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '160ms' }} />
              <span className="typing-dot" style={{ animationDelay: '320ms' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </main>

      {/* ── Composer ───────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-10 px-3 pt-2 pb-3 safe-bottom border-t border-tg-text/[0.06] bg-tg-bg">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={t(ctx.locale, 'aiyurist.placeholder')}
            className="flex-1 resize-none max-h-28 rounded-3xl px-4 py-2.5 text-[15px] leading-snug text-tg-text bg-tg-text/[0.05] border border-tg-text/[0.07] placeholder:text-tg-hint focus:outline-none focus:border-tg-text/[0.18] transition-colors"
          />
          <button
            onClick={() => void send(input)}
            disabled={!input.trim() || busy}
            className="press shrink-0 w-11 h-11 rounded-full brand-bg text-white grid place-items-center ring-accent disabled:opacity-40 disabled:saturate-0 transition-all"
            aria-label="Send"
          >
            <IconSend className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 px-2 text-[10.5px] leading-snug text-tg-hint/80 text-center">
          {t(ctx.locale, 'aiyurist.disclaimer')}
        </p>
      </div>
    </div>
  );
}
