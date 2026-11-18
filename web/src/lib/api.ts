import { getAccessToken } from './supabase';
import { supabaseDirectApi } from './supabase-direct';
import type { ApiErrorBody } from './types';

function resolveApiUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(configured);
      if (
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
        window.location.hostname &&
        window.location.hostname !== u.hostname
      ) {
        u.hostname = window.location.hostname;
        return u.toString().replace(/\/+$/, '');
      }
    } catch {
      // ignore
    }
  }
  return configured;
}

function isRemoteProductionWithoutConfiguredApi(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalBrowser = host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host);
  const configured = process.env.NEXT_PUBLIC_API_URL || '';
  const apiPointsToLocal = !configured || /localhost|127\.0\.0\.1/.test(configured);
  return !isLocalBrowser && apiPointsToLocal;
}

export function apiOrigin(): string {
  try {
    return new URL(resolveApiUrl()).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

export class ApiError extends Error {
  status: number;
  messages: string[];
  constructor(status: number, message: string | string[]) {
    const list = Array.isArray(message) ? message : [message];
    super(list.join(' · '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = list;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
}

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = opts;
  if (isRemoteProductionWithoutConfiguredApi()) {
    try {
      return await supabaseDirectApi<T>(path, { method, body, query });
    } catch (directErr) {
      throw new ApiError(400, (directErr as Error)?.message || 'Request failed');
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${resolveApiUrl()}${path}${buildQuery(query)}`, { method, headers, body: payload, signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    try {
      return await supabaseDirectApi<T>(path, { method, body, query });
    } catch (directErr) {
      throw new ApiError(400, (directErr as Error)?.message || 'Request failed');
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const errBody = data as Partial<ApiErrorBody> | null;
    const message =
      (errBody && typeof errBody === 'object' && errBody.message) ||
      (typeof data === 'string' && data) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(res.status, message as string | string[]);
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
