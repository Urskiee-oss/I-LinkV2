import React from 'react';
import clsx from 'clsx';
import { humanize } from '@/lib/format';
import type { FloodTier, ReportPriority, ReportStatus } from '@/lib/types';

type Tone = 'slate' | 'blue' | 'teal' | 'amber' | 'orange' | 'red' | 'emerald' | 'purple';

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function Badge({
  tone = 'slate',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReportStatus | string }) {
  const tone: Tone =
    status === 'resolved'
      ? 'emerald'
      : status === 'responding'
        ? 'blue'
        : status === 'under_review'
          ? 'amber'
          : 'slate';
  return <Badge tone={tone}>{humanize(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: ReportPriority | string }) {
  const tone: Tone =
    priority === 'critical' || priority === 'urgent'
      ? 'red'
      : priority === 'high' || priority === 'important'
        ? 'orange'
        : priority === 'medium'
          ? 'amber'
          : 'slate';
  return <Badge tone={tone}>{humanize(priority)}</Badge>;
}

export function FloodTierBadge({ tier }: { tier: FloodTier }) {
  const tone: Tone =
    tier === 'critical' || tier === 'danger'
      ? 'red'
      : tier === 'warning'
        ? 'orange'
        : tier === 'advisory'
          ? 'amber'
          : 'emerald';
  return <Badge tone={tone}>{humanize(tier)}</Badge>;
}
