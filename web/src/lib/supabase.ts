'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client — used ONLY for authentication
 * (sign in / sign out / session / token refresh). All data goes through the NestJS API.
 * When NEXT_PUBLIC_SUPABASE_URL is not yet configured, falls back to a local
 * token stored in localStorage returned by POST /api/auth/login.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LOCAL_TOKEN_KEY = 'ilink_local_access_token';

function looksConfigured(u: string, k: string): boolean {
  if (!u || !k) return false;
  if (/YOUR[-_]/i.test(u) || /YOUR[-_]/i.test(k)) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const supabaseConfigured = looksConfigured(url, anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export function setLocalAccessToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
  else window.localStorage.removeItem(LOCAL_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  }
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(LOCAL_TOKEN_KEY);
  }
  return null;
}
