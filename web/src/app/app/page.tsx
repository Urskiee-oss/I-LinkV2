'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AppIndexRedirect() {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace('/login');
      return;
    }
    if (me.primary_role === 'admin' || me.primary_role === 'responder') {
      router.replace('/app/dashboard');
    } else {
      router.replace('/app/home');
    }
  }, [me, loading, router]);

  return (
    <div className="py-12 text-center text-xs text-slate-500">
      Redirecting to your workspace…
    </div>
  );
}
