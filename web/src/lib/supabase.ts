'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client — pre-configured with the live I-Link Supabase Cloud
 * project (`bjqqffnkmasymkegthot`) so Vercel deployments work out of the box
 * even if environment variables were not manually copied into the Vercel dashboard.
 */
const DEFAULT_SUPABASE_URL = 'https://bjqqffnkmasymkegthot.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcXFmZm5rbWFzeW1rZWd0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMDUzNTgsImV4cCI6MjExMDU4MTM1OH0.4tFkpOGsv0CcqLiZofOmXjpHc8OcEVf_ccYoniDvgiI';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
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

const resolvedUrl = looksConfigured(envUrl, envKey) ? envUrl : DEFAULT_SUPABASE_URL;
const resolvedKey = looksConfigured(envUrl, envKey) ? envKey : DEFAULT_SUPABASE_ANON_KEY;

export const supabaseConfigured = true;

export const supabase: SupabaseClient = createClient(resolvedUrl, resolvedKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export function setLocalAccessToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
  else window.localStorage.removeItem(LOCAL_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(LOCAL_TOKEN_KEY);
  }
  return null;
}
