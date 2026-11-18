import React, { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
          Loading I-Link…
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
