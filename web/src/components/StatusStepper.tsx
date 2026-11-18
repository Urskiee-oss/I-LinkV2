import React from 'react';
import { Check } from 'lucide-react';
import { STATUS_ORDER, humanize } from '@/lib/format';
import type { ReportStatus } from '@/lib/types';
import clsx from 'clsx';

export function StatusStepper({ status }: { status: ReportStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="w-full py-2">
      <ol className="grid grid-cols-4 gap-2">
        {STATUS_ORDER.map((step, idx) => {
          const done = idx < currentIdx || status === 'resolved';
          const active = idx === currentIdx && status !== 'resolved';
          return (
            <li key={step} className="flex flex-col items-start gap-1.5">
              <div className="flex items-center w-full gap-2">
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-colors',
                    done
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : active
                        ? 'bg-[#1E40AF] border-[#1E40AF] text-white ring-4 ring-blue-100'
                        : 'bg-slate-100 border-slate-300 text-slate-500',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </span>
                {idx < STATUS_ORDER.length - 1 && (
                  <div
                    className={clsx(
                      'h-0.5 flex-1 rounded',
                      idx < currentIdx ? 'bg-emerald-600' : 'bg-slate-200',
                    )}
                  />
                )}
              </div>
              <span
                className={clsx(
                  'text-xs font-medium',
                  done || active ? 'text-slate-900' : 'text-slate-400',
                )}
              >
                {humanize(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
