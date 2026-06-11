import { getInitData } from './tg';

const API_BASE = '/api';

type LocalizedLabel = Record<'uz_cyrillic' | 'uz_latin' | 'ru', string>;

export interface CourtType {
  code: string;
  label: LocalizedLabel;
  active: boolean;
}
export interface Region {
  code: string;
  label: LocalizedLabel;
  courtName: LocalizedLabel;
  judgeName: LocalizedLabel;
}
export interface DistrictCourt {
  code: string;
  regionCode: string;
  courtTypeCode: string;
  name: LocalizedLabel;
  address?: LocalizedLabel;
}
export interface CourtInfo {
  code: string;
  regionCode: string;
  courtTypeCode: string;
  name: LocalizedLabel;
  address: string;
  phone: string;
  email: string;
}
export interface CaseEntry {
  caseNumber: string;
  time: string;
  category?: string;
  party1: string;
  party2: string;
  judge: string;
  instance: string;
}
export interface ScheduleResponse {
  total: number;
  matched: number;
  query: string | null;
  court: { code: string; name: LocalizedLabel };
  entries: CaseEntry[];
}

export interface TemplateSummary {
  code: string;
  category: string;
  courtTypeCode: string;
  title: LocalizedLabel;
  subtitle: LocalizedLabel;
}

export type SkipRule =
  | { kind: 'value-lt'; key: string; n: number }
  | { kind: 'not-equal'; key: string; value: string }
  | null;

export interface FieldChoice {
  value: string;
  label: LocalizedLabel;
}

export interface FieldDto {
  key: string;
  validator: string;
  label: LocalizedLabel;
  hint?: LocalizedLabel;
  multiline: boolean;
  hintCopyable: boolean;
  defaultValue?: string;
  choices?: FieldChoice[];
  splitDate?: { yearKey?: string; monthKey: string; dayKey: string };
  splitYearMonth?: { yearKey: string; monthKey: string };
  skipRule?: SkipRule;
}

export interface TemplateDetail {
  code: string;
  category: string;
  courtTypeCode: string;
  title: LocalizedLabel;
  subtitle: LocalizedLabel;
  description: LocalizedLabel;
  instructions: LocalizedLabel;
  fields: FieldDto[];
}

export interface MeResponse {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  language: 'uz_cyrillic' | 'uz_latin' | 'ru';
}

export interface DocumentSummary {
  id: number;
  templateId: number;
  format: 'docx' | 'pdf';
  createdAt: string;
  language: string;
  downloadToken: string;
  fileName: string;
}

export interface GenerateResponse {
  documentId: number;
  downloadToken: string;
  format: 'pdf' | 'docx';
  downloadUrl: string;
}

export interface ValidateResponse {
  ok: boolean;
  value: string;
  error: string | null;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('X-Telegram-Init-Data', getInitData());
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  // public
  courtTypes: () => request<CourtType[]>('/court-types'),
  /** Entry categories for the schedule flow: criminal + admin-offences. */
  scheduleCategories: () => request<CourtType[]>('/schedule-categories'),
  regions: () => request<Region[]>('/regions'),
  courts: (type: string, region: string) =>
    request<DistrictCourt[]>(`/courts/${encodeURIComponent(type)}/${encodeURIComponent(region)}`),
  /** Courts for the ariza wizard — same as `courts()` for most types
   *  but collapsed to 2-per-region for jinoyat (matching mamuriy). */
  arizaCourts: (type: string, region: string) =>
    request<DistrictCourt[]>(
      `/courts/${encodeURIComponent(type)}/${encodeURIComponent(region)}?for=ariza`,
    ),
  // court directory (info) flow: type → region → court
  infoTypes: () => request<CourtType[]>('/court-info/types'),
  infoRegions: (type: string) =>
    request<Region[]>(`/court-info/regions/${encodeURIComponent(type)}`),
  infoCourts: (region: string, type: string) =>
    request<CourtInfo[]>(
      `/court-info/courts/${encodeURIComponent(region)}/${encodeURIComponent(type)}`,
    ),
  templates: (type: string) =>
    request<TemplateSummary[]>(`/templates/${encodeURIComponent(type)}`),
  template: (code: string) =>
    request<TemplateDetail>(`/template/${encodeURIComponent(code)}`),
  schedule: (type: string, courtCode: string, dateISO: string, query?: string) => {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return request<ScheduleResponse>(
      `/schedule/${encodeURIComponent(type)}/${encodeURIComponent(courtCode)}/${dateISO}${q}`,
    );
  },
  validateField: (validator: string, value: string, locale: string) =>
    request<ValidateResponse>('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validator, value, locale }),
    }),

  // authenticated
  me: () => request<MeResponse>('/me'),
  setLanguage: (language: string) =>
    request<MeResponse>('/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    }),
  generate: (payload: {
    templateCode: string;
    courtTypeCode?: string;
    regionCode?: string;
    districtCourtCode?: string;
    values: Record<string, string>;
    format: 'pdf' | 'docx';
    locale: string;
  }) =>
    request<GenerateResponse>('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  documents: () => request<DocumentSummary[]>('/documents'),
  aiRewrite: (text: string, locale: string) =>
    request<{ text: string }>('/ai-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale }),
    }),
  aiYurist: (question: string, locale: string) =>
    request<{ answer: string }>('/ai-yurist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, locale }),
    }),
  transcribe: async (
    audio: Blob,
    locale: string,
    prompt?: string,
  ): Promise<{ text: string }> => {
    const qs = new URLSearchParams({ locale });
    if (prompt) qs.set('prompt', prompt);
    const headers = new Headers({
      'X-Telegram-Init-Data': getInitData(),
      'Content-Type': audio.type || 'audio/webm',
    });
    const res = await fetch(`${API_BASE}/transcribe?${qs.toString()}`, {
      method: 'POST',
      headers,
      body: audio,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { text: string };
  },
};

/** Mirrors src/services/webapp-api.ts → SkipRule serializer.
 *  Returns true when the field should be hidden for the current values. */
export function isFieldSkipped(
  field: FieldDto,
  values: Record<string, string>,
): boolean {
  const rule = field.skipRule;
  if (!rule) return false;
  if (rule.kind === 'value-lt') {
    return Number(values[rule.key] ?? '0') < rule.n;
  }
  if (rule.kind === 'not-equal') {
    return values[rule.key] !== rule.value;
  }
  return false;
}
