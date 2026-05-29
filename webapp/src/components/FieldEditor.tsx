import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../tg';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type FieldDto } from '../api';
import { Calendar } from './Calendar';

interface Props {
  field: FieldDto;
  locale: Locale;
  initialValue: string;
  onCommit: (value: string) => void;
  /** Currently collected values — used by some fields to produce
   *  contextual defaults (today's date for `date` etc.). Read-only. */
  values: Record<string, string>;
}

/**
 * Renders the editor UI for one wizard field. The right input is
 * picked from the field's `validator`. On submit (Enter / MainButton)
 * the value is server-validated, then committed via onCommit.
 *
 * Date / year-month validators replace the text input with the
 * Calendar component. choices render as a vertical button list.
 */
export function FieldEditor({ field, locale, initialValue, onCommit, values }: Props) {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Auto-focus the input on mount so the keyboard opens immediately on
  // mobile. Skipped for choice / date pickers which don't use a text input.
  useEffect(() => {
    if (
      field.validator !== 'choice' &&
      field.validator !== 'date' &&
      field.validator !== 'year-month'
    ) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [field.key, field.validator]);

  async function submit(raw: string) {
    if (!raw.trim()) {
      setError(t(locale, 'wiz.field.error', { error: '!' }));
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const res = await api.validateField(field.validator, raw, locale);
      if (!res.ok) {
        setError(res.error ?? '!');
        getTg().HapticFeedback.notificationOccurred('error');
        setValidating(false);
        return;
      }
      getTg().HapticFeedback.impactOccurred('light');
      onCommit(res.value);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setValidating(false);
    }
  }

  // ===== choice =====
  if (field.validator === 'choice' && field.choices) {
    return (
      <div className="flex flex-col gap-2">
        {field.choices.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              getTg().HapticFeedback.impactOccurred('medium');
              onCommit(c.value);
            }}
            className="bg-tg-section-bg rounded-2xl p-4 text-left row-tap"
          >
            <div className="text-[16px] font-medium text-tg-text">{c.label[locale]}</div>
          </button>
        ))}
      </div>
    );
  }

  // ===== date / splitDate (calendar picker; allows past dates) =====
  if (field.validator === 'date') {
    return (
      <Calendar
        locale={locale}
        onPick={(iso) => {
          // Convert YYYY-MM-DD → DD.MM.YYYY for consistency with bot's
          // canonical date format used in templates.
          const [y, m, d] = iso.split('-');
          onCommit(`${d}.${m}.${y}`);
        }}
        allowPast
      />
    );
  }

  // ===== year-month picker (year + month dropdowns) =====
  if (field.validator === 'year-month') {
    return (
      <YearMonthPicker
        locale={locale}
        initial={value}
        onPick={(canon) => onCommit(canon)}
      />
    );
  }

  // ===== multiline =====
  if (field.validator === 'multiline' || field.multiline) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          ref={inputRef as React.MutableRefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={t(locale, 'wiz.field.placeholder.multi')}
          rows={6}
          className="w-full bg-tg-section-bg rounded-2xl p-4 text-[16px] outline-none placeholder:text-tg-hint resize-y min-h-[160px]"
        />
        {error && (
          <div className="text-tg-destructive text-[13px]">{t(locale, 'wiz.field.error', { error })}</div>
        )}
        <SubmitButton
          loading={validating}
          onClick={() => void submit(value)}
          label={t(locale, 'btn.next')}
        />
        {/* AI-rewrite for multiline only */}
        <AiRewriteRow
          locale={locale}
          text={value}
          onApply={(rewritten) => setValue(rewritten)}
        />
        {/* Voice input — multiline fits long narratives best */}
        <VoiceRecorder locale={locale} field={field} onAppend={(extra) => setValue((prev) => prev ? `${prev}\n${extra}` : extra)} />
      </div>
    );
  }

  // ===== generic single-line input (text/fio/address/phone/money/number/year/day/month/share/order-number/stir/pinfl) =====
  const numericMode = ['number', 'year', 'day', 'money', 'stir', 'pinfl'].includes(field.validator);
  const phoneMode = field.validator === 'phone';

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef as React.MutableRefObject<HTMLInputElement>}
        type={phoneMode ? 'tel' : 'text'}
        inputMode={phoneMode ? 'tel' : numericMode ? 'numeric' : 'text'}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit(value);
          }
        }}
        placeholder={t(locale, 'wiz.field.placeholder')}
        className="w-full bg-tg-section-bg rounded-2xl p-4 text-[16px] outline-none placeholder:text-tg-hint"
      />
      {error && (
        <div className="text-tg-destructive text-[13px]">{t(locale, 'wiz.field.error', { error })}</div>
      )}
      <SubmitButton
        loading={validating}
        onClick={() => void submit(value)}
        label={t(locale, 'btn.next')}
      />
      {field.validator === 'address' && (
        <VoiceRecorder
          locale={locale}
          field={field}
          onAppend={(extra) => setValue(extra)}
        />
      )}
      {field.validator === 'fio' && (
        <VoiceRecorder
          locale={locale}
          field={field}
          onAppend={(extra) => setValue(extra)}
        />
      )}
      {/* Render dummy values reference so TS doesn't warn — useful for
          conditional defaults like today / locale-aware month name. */}
      {false && <span hidden>{Object.keys(values).length}</span>}
    </div>
  );
}

function SubmitButton({
  loading,
  onClick,
  label,
}: {
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-tg-button text-tg-button-text rounded-2xl p-4 font-semibold disabled:opacity-50"
    >
      {loading ? '…' : label}
    </button>
  );
}

// =====================================================================
// AI rewrite — Claude suggests an improved version of the user's text.
// =====================================================================

function AiRewriteRow({
  locale,
  text,
  onApply,
}: {
  locale: Locale;
  text: string;
  onApply: (rewritten: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');
  const [candidate, setCandidate] = useState<string | null>(null);

  async function go() {
    if (!text.trim() || text.trim().length < 10) return;
    setState('working');
    try {
      const out = await api.aiRewrite(text, locale);
      setCandidate(out.text);
      setState('idle');
    } catch {
      setState('failed');
    }
  }

  if (candidate) {
    return (
      <div className="bg-tg-section-bg rounded-2xl p-3 flex flex-col gap-2">
        <div className="text-[13px] text-tg-subtitle">AI:</div>
        <div className="text-[14px] whitespace-pre-line">{candidate}</div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onApply(candidate);
              setCandidate(null);
            }}
            className="flex-1 bg-tg-button text-tg-button-text rounded-xl p-2.5 text-[14px] font-medium"
          >
            {t(locale, 'wiz.ai.use-rewritten')}
          </button>
          <button
            onClick={() => setCandidate(null)}
            className="flex-1 bg-tg-secondary-bg rounded-xl p-2.5 text-[14px]"
          >
            {t(locale, 'wiz.ai.use-original')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => void go()}
      disabled={state === 'working' || !text.trim()}
      className="bg-tg-section-bg text-tg-link rounded-2xl p-3 text-[14px] disabled:opacity-50"
    >
      {state === 'working'
        ? t(locale, 'wiz.ai.working')
        : state === 'failed'
          ? t(locale, 'wiz.ai.failed')
          : t(locale, 'wiz.ai.improve')}
    </button>
  );
}

// =====================================================================
// Voice → text via MediaRecorder + /api/transcribe
// =====================================================================

function VoiceRecorder({
  locale,
  field,
  onAppend,
}: {
  locale: Locale;
  field: FieldDto;
  onAppend: (text: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        void upload(blob);
      };
      rec.start();
      recRef.current = rec;
      setState('recording');
      getTg().HapticFeedback.impactOccurred('medium');
    } catch {
      getTg().showAlert(t(locale, 'wiz.voice.unavailable'));
    }
  }

  function stop() {
    if (!recRef.current) return;
    setState('processing');
    recRef.current.stop();
  }

  async function upload(blob: Blob) {
    try {
      const res = await api.transcribe(blob, locale, hintFor(field.validator, locale));
      if (res.text) {
        onAppend(res.text.trim());
        getTg().HapticFeedback.notificationOccurred('success');
      }
    } catch (e) {
      getTg().showAlert(String((e as Error).message));
    } finally {
      setState('idle');
    }
  }

  return (
    <button
      onClick={state === 'recording' ? stop : start}
      disabled={state === 'processing'}
      className="bg-tg-section-bg text-tg-link rounded-2xl p-3 text-[14px] disabled:opacity-50"
    >
      {state === 'recording'
        ? t(locale, 'wiz.voice.stop')
        : state === 'processing'
          ? t(locale, 'wiz.voice.processing')
          : t(locale, 'wiz.voice.start')}
    </button>
  );
}

function pickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of cands) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function hintFor(validator: string, locale: Locale): string | undefined {
  // Same idea as the bot's voice-prompts.ts — give Whisper a vocabulary
  // anchor for the kind of content we expect.
  if (validator === 'fio') {
    return locale === 'ru'
      ? 'Русские и узбекские ФИО. Иванов Алексей Петрович, Каримов Алишер Расулович.'
      : 'Ўзбек исм-шарифи. Каримов Алишер Расулович, Сулайманова Дилнура.';
  }
  if (validator === 'address' || validator === 'text' || validator === 'multiline') {
    return locale === 'ru'
      ? 'Адрес в Узбекистане. Ташкент, улица Бунёдкор, дом 12.'
      : 'Ўзбекистон манзили. Тошкент, Бунёдкор кўчаси, 12-уй.';
  }
  return undefined;
}

// =====================================================================
// Year-month picker — two dropdowns. Output canonicalised as
// "<month-name> <year>" matching parseUserYearMonth's canonical form.
// =====================================================================

function YearMonthPicker({
  locale,
  initial,
  onPick,
}: {
  locale: Locale;
  initial: string;
  onPick: (canon: string) => void;
}) {
  const now = new Date();
  const monthNamesUz = [
    'январ', 'феврал', 'март', 'апрел', 'май', 'июн',
    'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
  ];
  const monthNamesUzLa = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
  ];
  const monthNamesRu = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  ];
  const names =
    locale === 'ru' ? monthNamesRu : locale === 'uz_latin' ? monthNamesUzLa : monthNamesUz;

  // Parse "<month> <year>" from initial if present
  const parsed = parseInit(initial, names);
  const [year, setYear] = useState(parsed?.year ?? now.getFullYear());
  const [month, setMonth] = useState(parsed?.month ?? now.getMonth() + 1);
  void parsed; // mark used

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= 1950; y--) years.push(y);

  function commit() {
    const canon = `${names[month - 1]} ${year}`;
    onPick(canon);
    getTg().HapticFeedback.impactOccurred('medium');
  }

  return (
    <div className="bg-tg-section-bg rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 bg-tg-secondary-bg rounded-xl p-3 text-[15px] outline-none"
        >
          {names.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 bg-tg-secondary-bg rounded-xl p-3 text-[15px] outline-none"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <button
        onClick={commit}
        className="bg-tg-button text-tg-button-text rounded-2xl p-3 font-semibold"
      >
        {t(locale, 'btn.next')}
      </button>
    </div>
  );
}

function parseInit(s: string, monthNames: string[]) {
  if (!s) return null;
  const m = /^([\p{L}]+)\s+(\d{4})$/u.exec(s.trim().toLowerCase());
  if (!m) return null;
  const idx = monthNames.indexOf(m[1]!);
  if (idx < 0) return null;
  return { month: idx + 1, year: Number(m[2]) };
}
