import { getTg } from './tg';

/**
 * Tiny REST client for the bot's /api/* endpoints. Always sends
 * the user's initData in the X-Telegram-Init-Data header so backend
 * handlers can validate auth when they need to.
 *
 * Endpoints are colocated with the bot in src/services/webapp-api.ts.
 */

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

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-Telegram-Init-Data': getTg().initData,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  courtTypes: () => request<CourtType[]>('/court-types'),
  regions: () => request<Region[]>('/regions'),
  courts: (type: string, region: string) =>
    request<DistrictCourt[]>(`/courts/${encodeURIComponent(type)}/${encodeURIComponent(region)}`),
  schedule: (type: string, courtCode: string, dateISO: string, query?: string) => {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return request<ScheduleResponse>(
      `/schedule/${encodeURIComponent(type)}/${encodeURIComponent(courtCode)}/${dateISO}${q}`,
    );
  },
};
