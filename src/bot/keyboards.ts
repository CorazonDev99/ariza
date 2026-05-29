import { Markup } from 'telegraf';
import { LOCALE_META, LOCALES, t, type Locale } from '../i18n';
import type { TemplateDef } from '../types';
import type { RegionDef } from '../templates/regions';
import type { CourtTypeDef } from '../templates/court-types';
import type { DistrictCourtDef } from '../templates/district-courts';

// Main reply keyboard. Intentionally NOT persistent — the user can
// collapse it with the chevron / Android back button when they want to
// see more of the conversation history. The keyboard re-appears on the
// next bot message.
export function mainMenu(locale: Locale) {
  return Markup.keyboard([
    [t(locale, 'menu.new')],
    [t(locale, 'menu.jadval')],
    [t(locale, 'menu.instructions'), t(locale, 'menu.about')],
    [t(locale, 'menu.lang')],
  ]).resize();
}

/**
 * Inline keyboard shown under the "Bot haqida" message.
 * Links the support button to https://t.me/<supportContact> when the
 * env var is set; otherwise the keyboard has no button.
 */
export function aboutInline(locale: Locale, supportContact: string) {
  if (!supportContact) return Markup.inlineKeyboard([]);
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        t(locale, 'about.support_btn'),
        `https://t.me/${supportContact}`,
      ),
    ],
  ]);
}

export function wizardMenu(locale: Locale) {
  return Markup.keyboard([
    [t(locale, 'btn.back'), t(locale, 'btn.cancel')],
  ])
    .resize()
    .persistent();
}

export const removeKeyboard = Markup.removeKeyboard();

export function templatesInline(
  locale: Locale,
  templates: TemplateDef[],
) {
  return Markup.inlineKeyboard([
    ...templates.map((tpl) => [
      Markup.button.callback(tpl.title[locale], `tmpl:${tpl.code}`),
    ]),
    [Markup.button.callback(t(locale, 'tmpl.back'), 'back-districts')],
  ]);
}

/**
 * Inline keyboard for the court-type picker — first step in the multi-
 * step "submit an application" flow. One row per type so long Cyrillic
 * labels don't get truncated.
 */
// No "🏠 Main menu" inline button — the persistent reply keyboard at
// the bottom of the chat already gives the user one-tap access to every
// menu action, and /-commands work everywhere too (see scene.command in
// the wizard scene). An extra inline button just clutters the picker.
export function courtTypesInline(locale: Locale, types: CourtTypeDef[]) {
  return Markup.inlineKeyboard(
    types.map((c) => [Markup.button.callback(c.label[locale], `ct:${c.code}`)]),
  );
}

/**
 * Inline keyboard for region selection.
 * Lays regions out in two columns (like the screenshot) for a tidy grid.
 */
export function regionsInline(locale: Locale, regions: RegionDef[]) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < regions.length; i += 2) {
    const row = [Markup.button.callback(regions[i]!.label[locale], `region:${regions[i]!.code}`)];
    const next = regions[i + 1];
    if (next) row.push(Markup.button.callback(next.label[locale], `region:${next.code}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback(t(locale, 'region.back'), 'back-courts')]);
  return Markup.inlineKeyboard(rows);
}

/**
 * Inline keyboard listing district courts within the selected region.
 * Court names can be long (e.g. "Andijon tumanlararo fuqarolik sudi"),
 * so each court gets its own row — two columns would truncate badly.
 */
export function districtCourtsInline(
  locale: Locale,
  courts: DistrictCourtDef[],
) {
  // Two-line button label: court name on top, address on bottom.
  // Telegram inline buttons accept "\n" and render it as a soft line
  // break in the button label. Mirrors the visual layout of MySud
  // cards so users can pick the correct local court without a
  // separate lookup. Falls back to name-only when address is missing.
  return Markup.inlineKeyboard([
    ...courts.map((c) => {
      const addr = c.address?.[locale];
      const label = addr ? `${c.name[locale]}\n${addr}` : c.name[locale];
      return [Markup.button.callback(label, `dc:${c.code}`)];
    }),
    [Markup.button.callback(t(locale, 'district.back'), 'back-regions')],
  ]);
}

/**
 * Inline keyboard for `choice`-validator fields. One button per option,
 * each on its own row so long Cyrillic labels don't get truncated. The
 * callback id encodes both the field key and the chosen value so the
 * scene handler can route the click back through `commitFieldValue`.
 */
export function choiceInline(
  locale: Locale,
  fieldKey: string,
  choices: NonNullable<import('../types').FieldDef['choices']>,
) {
  return Markup.inlineKeyboard(
    choices.map((c) => [
      Markup.button.callback(c.label[locale], `choice:${fieldKey}:${c.value}`),
    ]),
  );
}

export function previewInline(locale: Locale) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'preview.confirm'), 'preview:confirm')],
    [Markup.button.callback(t(locale, 'preview.edit'), 'preview:edit')],
    [Markup.button.callback(t(locale, 'preview.cancel'), 'preview:cancel')],
  ]);
}

export function paymentInline(locale: Locale, payUrl: string, amount: number) {
  return Markup.inlineKeyboard([
    [Markup.button.url(t(locale, 'btn.pay', { amount: formatAmount(amount) }), payUrl)],
    [Markup.button.callback(t(locale, 'pay.check'), 'pay:check')],
    [Markup.button.callback(t(locale, 'btn.back'), 'pay:back-to-provider')],
    [Markup.button.callback(t(locale, 'preview.cancel'), 'pay:cancel')],
  ]);
}

/** Format sum like 1500 → "1 500" (Russian/Uzbek convention). */
export function formatAmount(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

/** Provider picker shown right after the preview is confirmed. */
export function providerInline(locale: Locale) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'pay.btn.click'), 'pay:provider:click')],
    [Markup.button.callback(t(locale, 'pay.btn.payme'), 'pay:provider:payme')],
    [Markup.button.callback(t(locale, 'btn.back'), 'pay:back-to-preview')],
    [Markup.button.callback(t(locale, 'preview.cancel'), 'pay:cancel')],
  ]);
}

// No "🏠 Main menu" button — the persistent reply keyboard already
// provides one-tap access to everything, and the user can just ignore
// this picker if they decided not to switch language.
export function languageInline(_locale: Locale) {
  return Markup.inlineKeyboard(
    LOCALES.map((code) => [
      Markup.button.callback(
        `${LOCALE_META[code].flag} ${LOCALE_META[code].label}`,
        `lang:${code}`,
      ),
    ]),
  );
}

// =====================================================================
// Date-picker keyboards
// =====================================================================
//
// Used for fields with validator `year`, `month`, `day`, and `date`.
// Callback id layout:
//   dp:y:<year>          year selected
//   dp:m:<1..12>         month selected (1-indexed)
//   dp:d:<1..31>         day selected
//   dp:ypage:<page>      year pagination (page 0 = most recent)
//   dp:back              one step back in the multi-step `date` picker
// =====================================================================

const YEARS_PER_PAGE = 12;

/** Year picker. baseYear defaults to current year. */
export function yearPickerInline(locale: Locale, page = 0, baseYear?: number) {
  const top = baseYear ?? new Date().getFullYear();
  const start = top - page * YEARS_PER_PAGE;
  const years: number[] = [];
  for (let i = 0; i < YEARS_PER_PAGE; i++) years.push(start - i);

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < years.length; i += 4) {
    rows.push(
      years
        .slice(i, i + 4)
        .map((y) => Markup.button.callback(String(y), `dp:y:${y}`)),
    );
  }
  // pagination row
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  // "next" = older years (page+1). We don't go below year 1900.
  if (start - YEARS_PER_PAGE >= 1900) {
    nav.push(
      Markup.button.callback(t(locale, 'dp.next'), `dp:ypage:${page + 1}`),
    );
  }
  if (page > 0) {
    nav.unshift(
      Markup.button.callback(t(locale, 'dp.prev'), `dp:ypage:${page - 1}`),
    );
  }
  if (nav.length) rows.push(nav);
  return Markup.inlineKeyboard(rows);
}

export function monthPickerInline(locale: Locale, showBack = false) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 1; i <= 12; i += 4) {
    rows.push(
      [i, i + 1, i + 2, i + 3].map((m) =>
        Markup.button.callback(t(locale, `month.${m}`), `dp:m:${m}`),
      ),
    );
  }
  if (showBack) {
    rows.push([Markup.button.callback(t(locale, 'btn.back'), 'dp:back')]);
  }
  return Markup.inlineKeyboard(rows);
}

export function dayPickerInline(locale: Locale, showBack = false) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 1; i <= 31; i += 7) {
    rows.push(
      Array.from({ length: 7 }, (_, k) => i + k)
        .filter((d) => d <= 31)
        .map((d) => Markup.button.callback(String(d), `dp:d:${d}`)),
    );
  }
  if (showBack) {
    rows.push([Markup.button.callback(t(locale, 'btn.back'), 'dp:back')]);
  }
  return Markup.inlineKeyboard(rows);
}

// =====================================================================
// Month-view calendar (cal:*)
// =====================================================================
//
// Layout:
//   [◀ prev month]  [Month Year ← year-jump]  [▶ next month]
//   [Пн][Вт][Ср][Чт][Пт][Сб][Вс]   (weekday labels)
//   [.. .. ..  1  2  3  4]
//   [ 5  6  7  8  9 10 11]
//   ...
//   [⬅️ Орқага]
//
// Callback data:
//   cal:nav:<y>:<m>     navigate to year-month
//   cal:yearmode        switch to year jump
//   cal:y:<y>           pick year from year-jump
//   cal:ypage:<p>       paginate year-jump
//   cal:d:<y>:<m>:<d>   final pick
//   cal:back            exit calendar (return to wizard previous step)
//   cal:noop            non-clickable cells (empty days, weekday labels)
// =====================================================================

const CAL_MIN_YEAR = 1900;
const CAL_MAX_YEAR = 2100;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Capitalize first character (for month names like "январ" → "Январ"). */
function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  let y = year;
  let m = month + delta;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return { y, m };
}

/** Month-view calendar. `month` is 1-indexed. */
export function calendarInline(locale: Locale, year: number, month: number) {
  const monthName = capitalize(t(locale, `month.${month}`));
  const header = `${monthName} ${year}`;

  const total = daysInMonth(year, month);
  // JS getDay(): 0=Sun..6=Sat. Shift so Monday=0..Sunday=6 (UZ/RU convention).
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  // Navigation row: ◀  HEADER  ▶
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (prev.y >= CAL_MIN_YEAR) {
    navRow.push(Markup.button.callback('◀', `cal:nav:${prev.y}:${prev.m}`));
  } else {
    navRow.push(Markup.button.callback(' ', 'cal:noop'));
  }
  navRow.push(Markup.button.callback(header, 'cal:yearmode'));
  if (next.y <= CAL_MAX_YEAR) {
    navRow.push(Markup.button.callback('▶', `cal:nav:${next.y}:${next.m}`));
  } else {
    navRow.push(Markup.button.callback(' ', 'cal:noop'));
  }
  rows.push(navRow);

  // Weekday header row
  rows.push(
    [1, 2, 3, 4, 5, 6, 7].map((d) =>
      Markup.button.callback(t(locale, `cal.wd.${d}`), 'cal:noop'),
    ),
  );

  // Day grid (6 weeks max)
  let day = 1;
  for (let week = 0; week < 6; week++) {
    if (day > total) break;
    const row: ReturnType<typeof Markup.button.callback>[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const slot = week * 7 + dow;
      if (slot < firstDow || day > total) {
        row.push(Markup.button.callback(' ', 'cal:noop'));
      } else {
        row.push(
          Markup.button.callback(String(day), `cal:d:${year}:${month}:${day}`),
        );
        day += 1;
      }
    }
    rows.push(row);
  }

  rows.push([Markup.button.callback(t(locale, 'btn.back'), 'cal:back')]);
  return Markup.inlineKeyboard(rows);
}

/** Year-jump picker shown when the calendar header is tapped. */
export function calendarYearInline(
  locale: Locale,
  monthHint: number,
  page = 0,
  baseYear?: number,
) {
  const top = baseYear ?? new Date().getFullYear();
  const start = top - page * YEARS_PER_PAGE;
  const years: number[] = [];
  for (let i = 0; i < YEARS_PER_PAGE; i++) years.push(start - i);

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < years.length; i += 4) {
    rows.push(
      years.slice(i, i + 4).map((y) =>
        Markup.button.callback(String(y), `cal:y:${y}:${monthHint}`),
      ),
    );
  }
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    nav.push(Markup.button.callback(t(locale, 'dp.prev'), `cal:ypage:${page - 1}:${monthHint}`));
  }
  if (start - YEARS_PER_PAGE >= CAL_MIN_YEAR) {
    nav.push(Markup.button.callback(t(locale, 'dp.next'), `cal:ypage:${page + 1}:${monthHint}`));
  }
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback(t(locale, 'btn.back'), `cal:nav:${top - page * YEARS_PER_PAGE}:${monthHint}`)]);
  return Markup.inlineKeyboard(rows);
}

/** Progress bar: filled ▰, empty ▱. */
export function progressBar(current: number, total: number, width = 10): string {
  const ratio = total === 0 ? 0 : Math.min(1, current / total);
  const filled = Math.round(ratio * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

/** Resolve translated menu button text → locale-agnostic action id. */
export type MenuAction =
  | 'new'
  | 'instructions'
  | 'jadval'
  | 'about'
  | 'lang'
  | 'back'
  | 'cancel';

export function detectMenuAction(text: string): MenuAction | null {
  for (const locale of LOCALES) {
    if (text === t(locale, 'menu.new')) return 'new';
    if (text === t(locale, 'menu.instructions')) return 'instructions';
    if (text === t(locale, 'menu.jadval')) return 'jadval';
    if (text === t(locale, 'menu.about')) return 'about';
    if (text === t(locale, 'menu.lang')) return 'lang';
    if (text === t(locale, 'btn.back')) return 'back';
    if (text === t(locale, 'btn.cancel')) return 'cancel';
  }
  return null;
}

/** Inline keyboard: list of template choices shown at the LAST step of
 *  the guide picker (after the user picked court type → region →
 *  district). Back button returns to the district picker. */
export function instructionsListInline(
  locale: Locale,
  templates: TemplateDef[],
) {
  return Markup.inlineKeyboard([
    ...templates.map((tpl) => [
      Markup.button.callback(tpl.title[locale], `inst:${tpl.code}`),
    ]),
    [Markup.button.callback(t(locale, 'tmpl.back'), 'g-back-districts')],
  ]);
}

/** Inline keyboard shown under a single template's instruction text. */
export function instructionsDetailInline(locale: Locale, code: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'instructions.start_btn'), `inst-start:${code}`)],
    [Markup.button.callback(t(locale, 'instructions.back_btn'), 'inst-back')],
  ]);
}

// =====================================================================
// 📖 Guide flow: multi-step picker that mirrors the wizard's entry but
// leads to instruction text (not field collection). Uses `g-` prefixes
// to keep callbacks distinct from the wizard scene's `ct:`/`region:`/`dc:`.
// =====================================================================

// See note on courtTypesInline — no "🏠 Main menu" button.
export function guideCourtTypesInline(locale: Locale, types: CourtTypeDef[]) {
  return Markup.inlineKeyboard(
    types.map((c) => [Markup.button.callback(c.label[locale], `g-ct:${c.code}`)]),
  );
}

export function guideRegionsInline(locale: Locale, regions: RegionDef[]) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < regions.length; i += 2) {
    const row = [Markup.button.callback(regions[i]!.label[locale], `g-region:${regions[i]!.code}`)];
    const next = regions[i + 1];
    if (next) row.push(Markup.button.callback(next.label[locale], `g-region:${next.code}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback(t(locale, 'region.back'), 'g-back-courts')]);
  return Markup.inlineKeyboard(rows);
}

export function guideDistrictCourtsInline(
  locale: Locale,
  courts: DistrictCourtDef[],
) {
  return Markup.inlineKeyboard([
    ...courts.map((c) => [
      Markup.button.callback(c.name[locale], `g-dc:${c.code}`),
    ]),
    [Markup.button.callback(t(locale, 'district.back'), 'g-back-regions')],
  ]);
}

// =====================================================================
// 📋 jadval2 flow: court-type → region → court → schedule. Uses `jdv-`
// prefixes to stay distinct from the wizard (ct/region/dc) and guide
// (g-ct/g-region/g-dc) callback namespaces.
// =====================================================================

export function jadvalTypesInline(locale: Locale, types: CourtTypeDef[]) {
  return Markup.inlineKeyboard(
    types
      .filter((c) => c.active)
      .map((c) => [Markup.button.callback(c.label[locale], `jdv-ct:${c.code}`)]),
  );
}

export function jadvalRegionsInline(locale: Locale, regions: RegionDef[]) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < regions.length; i += 2) {
    const row = [
      Markup.button.callback(regions[i]!.label[locale], `jdv-region:${regions[i]!.code}`),
    ];
    const next = regions[i + 1];
    if (next) row.push(Markup.button.callback(next.label[locale], `jdv-region:${next.code}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback(t(locale, 'jadval.back-types'), 'jdv-back-types')]);
  return Markup.inlineKeyboard(rows);
}

export function jadvalCourtsInline(
  locale: Locale,
  courts: DistrictCourtDef[],
) {
  return Markup.inlineKeyboard([
    ...courts.map((c) => [
      Markup.button.callback(c.name[locale], `jdv-court:${c.code}`),
    ]),
    [Markup.button.callback(t(locale, 'jadval.back-regions'), 'jdv-back-regions')],
  ]);
}

/** Shown under the final schedule message — lets the user pick another
 *  date / court without retyping. For MVP just a "back to courts" button. */
export function jadvalResultsInline(locale: Locale) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'jadval.back-regions'), 'jdv-back-regions')],
  ]);
}

// =====================================================================
// AI-assist (free-form multiline fields)
// =====================================================================
//
// Two states:
//   1. "raw"       — user just typed text; offer ✨AI-улучшить / ✅Сохранить.
//   2. "rewritten" — AI returned a candidate; offer ✅Сохранить эту /
//                    🔁Попробовать ещё / ✏️Мой текст.
// =====================================================================

/** Stage 1 — user's raw text was accepted; offer optional AI improvement. */
export function aiAssistRawInline(locale: Locale) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'ai.btn.improve'), 'ai:improve')],
    [Markup.button.callback(t(locale, 'ai.btn.keep'), 'ai:keep')],
  ]);
}

/** Stage 2 — AI candidate is ready; user picks between AI and original. */
export function aiAssistRewrittenInline(locale: Locale) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(locale, 'ai.btn.accept'), 'ai:accept')],
    [Markup.button.callback(t(locale, 'ai.btn.retry'), 'ai:retry')],
    [Markup.button.callback(t(locale, 'ai.btn.original'), 'ai:original')],
  ]);
}
