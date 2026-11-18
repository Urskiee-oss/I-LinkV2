'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { api } from './api';
import type { AppRole, Me } from './types';

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  purok?: string;
}

interface AuthContextValue {
  session: Session | null;
  me: Me | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<Me>;
  register: (input: RegisterInput) => Promise<Me>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  hasRole: (...roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = useCallback(async (): Promise<Me | null> => {
    try {
      const profile = await api<Me>('/auth/me');
      setMe(profile);
      return profile;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await refreshMe();
      }
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        await refreshMe();
      } else {
        setMe(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<Me> => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local.',
        );
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(error?.message || 'Invalid email or password.');
      }
      setSession(data.session);
      const profile = await api<Me>('/auth/me');
      setMe(profile);
      return profile;
    },
    [],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<Me> => {
      await api<{ id: string; email: string }>('/auth/register', {
        method: 'POST',
        auth: false,
        body: input,
      });
      return login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setMe(null);
  }, []);

  const hasRole = useCallback(
    (...roles: AppRole[]): boolean => {
      if (!me) return false;
      return roles.some((r) => me.roles.includes(r));
    },
    [me],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        me,
        loading,
        configured: supabaseConfigured,
        login,
        register,
        logout,
        refreshMe,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
