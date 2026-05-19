import { z } from 'zod';
import type { Locale } from '../i18n';
import type { ValidatorKind } from '../validators';

export type DocumentFormat = 'docx' | 'pdf';

/** Field localized labels & hints. */
export interface LocalizedField {
  label: Record<Locale, string>;
  hint?: Record<Locale, string>;
}

export interface FieldDef extends LocalizedField {
  key: string;
  validator: ValidatorKind;
  defaultValue?: string;
  multiline?: boolean;
  /** When true, the hint is rendered inside a Telegram `<code>` block
   *  so the user can tap to copy it (then paste & edit). Useful for
   *  fields whose hint is a sample value (e.g. address). */
  hintCopyable?: boolean;
  /**
   * Skip this field if predicate returns true given values
   * already collected. Useful for "no children" branches.
   */
  skipIf?: (values: Record<string, string>) => boolean;
  /**
   * When skipped, this value is written to the data instead.
   * Defaults to "—".
   */
  skipValue?: string;
  /**
   * For composite date fields. When set, the wizard shows ONE calendar
   * but writes the picked date into 2-3 different value keys (year, month,
   * day) so that .docx templates with separate {{order_year}}, {{order_month}},
   * {{order_day}} placeholders keep working.
   * Omit `yearKey` for cases where year is implicit (e.g. "when did you
   * learn about the order" — template only uses month + day).
   */
  splitDate?: {
    yearKey?: string;
    monthKey: string;
    dayKey: string;
  };
  /**
   * For `year-month` fields, optionally write the picked year and month
   * into two separate value keys (in addition to the combined display
   * string under `f.key`). Lets templates use `{{separation_year}}` and
   * `{{separation_month}}` instead of one inline placeholder.
   */
  splitYearMonth?: {
    yearKey: string;
    monthKey: string;
  };
  /**
   * For `choice`-validator fields. Renders inline buttons (one per
   * option) instead of asking the user to type a value. Clicking a
   * button commits the option's `value` through the normal validation
   * pipeline. Locale-aware `label` is what the user sees on the button.
   */
  choices?: Array<{
    value: string;
    label: Record<Locale, string>;
  }>;
}

export interface CategoryDef {
  code: string;
  title: Record<Locale, string>;
}

export interface TemplateDef {
  code: string;
  category: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  description: Record<Locale, string>;
  /** Long-form HTML-formatted instructions shown via the "📖 Guide" menu.
   *  Tells the user when to file, where, what supporting documents to attach
   *  and what fields the wizard will ask. */
  instructions: Record<Locale, string>;
  fields: FieldDef[];
  /** Generated as `<code>.<locale>.docx`. */
  fileNameBase: string;
}

export interface WizardState {
  templateCode: string;
  templateDbId: number;
  /** Court type chosen at the very first step of the multi-step flow
   *  (see `templates/court-types.ts`). */
  courtTypeCode?: string;
  /** Selected region code (see `templates/regions.ts`). */
  regionCode?: string;
  /** Selected district / interdistrict court (see `templates/district-courts.ts`).
   *  Its name is also written into `values.court_name` for the document. */
  districtCourtCode?: string;
  currentFieldIndex: number;
  values: Record<string, string>;
  status: 'collecting' | 'preview' | 'awaiting_payment' | 'done';
  paymentId?: number;
  /** Multi-step inline date picker state, used when the current field
   *  validator is `date`. Cleared when the date is assembled. */
  datePicker?: {
    step: 'year' | 'month' | 'day';
    year?: number;
    month?: number;
    /** Which page of years is currently shown (0 = most recent). */
    yearPage?: number;
  };
  /** AI-rewrite substate for free-form (`multiline`) fields. While set,
   *  the wizard is showing the user a confirm/AI-improve prompt and is NOT
   *  accepting plain-text input for the current field — the user must press
   *  one of the inline buttons. Cleared on commit or "back to original". */
  aiAssist?: {
    /** Sanity check — the field this rewrite belongs to. */
    fieldKey: string;
    /** What the user originally typed. */
    original: string;
    /** Latest AI rewrite, shown as the current candidate. Undefined until
     *  the first ai:improve click. */
    rewritten?: string;
  };
  /** Month-view calendar state for `date` validator + `splitDate` fields.
   *  Persisted so a restart resumes at the same month the user was viewing. */
  calendarPicker?: {
    /** Currently displayed year. */
    year: number;
    /** Currently displayed month, 1-12. */
    month: number;
    /** When true, calendar is showing the year-jump picker instead of days. */
    yearMode?: boolean;
    /** Pagination page of the year-jump picker (0 = most recent). */
    yearPage?: number;
    /** Telegram message_id of the calendar message (so we can edit it
     *  in place instead of sending a new one for every navigation). */
    messageId?: number;
  };
}

export const ValuesSchema = z.record(z.string(), z.string());
export type Values = z.infer<typeof ValuesSchema>;
