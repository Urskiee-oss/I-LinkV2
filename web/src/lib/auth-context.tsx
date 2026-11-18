'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAccessToken, setLocalAccessToken, supabase, supabaseConfigured } from './supabase';
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

function makeSyntheticSession(accessToken: string, userId: string, email: string): Session {
  return {
    access_token: accessToken,
    refresh_token: accessToken,
    expires_in: 86400,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

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
    let mounted = true;
    if (!supabase) {
      getAccessToken().then(async (token) => {
        if (!mounted) return;
        if (token) {
          const profile = await refreshMe();
          if (profile && mounted) {
            setSession(makeSyntheticSession(token, profile.id, profile.email));
          } else {
            setLocalAccessToken(null);
          }
        }
        if (mounted) setLoading(false);
      });
      return () => {
        mounted = false;
      };
    }

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

  const login = useCallback(async (email: string, password: string): Promise<Me> => {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session) {
          setSession(data.session);
          const profile = await api<Me>('/auth/me');
          setMe(profile);
          return profile;
        }
      } catch {
        // Fall through to NestJS /auth/login endpoint
      }
    }

    const res = await api<{ access_token: string; user: { id: string; email: string } }>(
      '/auth/login',
      {
        method: 'POST',
        auth: false,
        body: { email, password },
      },
    );
    setLocalAccessToken(res.access_token);
    setSession(makeSyntheticSession(res.access_token, res.user.id, res.user.email));
    const profile = await api<Me>('/auth/me');
    setMe(profile);
    return profile;
  }, []);

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
    setLocalAccessToken(null);
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
        configured: true || supabaseConfigured,
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
