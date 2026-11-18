'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@ilink.demo', role: 'Barangay Captain / Admin' },
  { label: 'Responder', email: 'responder@ilink.demo', role: 'DRRM / Tanod Responder' },
  { label: 'Resident', email: 'resident@ilink.demo', role: 'Barangay Resident' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await login(email.trim(), password);
      if (me.primary_role === 'admin' || me.primary_role === 'responder') {
        router.push('/app/dashboard');
      } else {
        router.push('/app/home');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('ILinkDemo2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E40AF] text-white font-bold">
              IL
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Sign in to I-Link</h1>
          <p className="text-xs text-slate-600">
            AI-Powered Community Intelligence &amp; Resilience Platform
          </p>
        </div>

        {!configured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Supabase environment variables not configured</p>
              <p className="mt-0.5 text-amber-800">
                Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
                <code className="font-mono">web/.env.local</code>, then restart the dev server.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardBody className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Sign In
              </Button>
            </form>

            {/* Quick Demo Fill */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <KeyRound className="h-3.5 w-3.5 text-blue-700" />
                <span>Quick-fill seeded demo accounts (Password: ILinkDemo2026!)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => fillDemo(d.email)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-900">{d.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{d.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-slate-600">
          New barangay resident?{' '}
          <Link href="/register" className="font-semibold text-[#1E40AF] hover:underline">
            Create an account
          </Link>
        </p>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Protected by Supabase Auth &amp; Role-Based Access Control</span>
        </div>
      </div>
    </div>
  );
}
