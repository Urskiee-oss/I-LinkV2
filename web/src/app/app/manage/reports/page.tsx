'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Sparkles } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { STATUS_ORDER, formatDateTime, humanize } from '@/lib/format';
import type { CommunityReport } from '@/lib/types';
import { Badge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function ManageReportsPage() {
  const [items, setItems] = useState<CommunityReport[]>([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<CommunityReport[]>('/reports', {
        query: {
          module: moduleFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      setItems(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('report:new', () => load());
  useRealtimeEvent('report:updated', () => load());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Community &amp; I-Link Clean Reports Queue
            </h1>
            <p className="text-xs text-slate-600">
              Triage municipal maintenance, sanitation, and infrastructure concerns
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Modules</option>
            <option value="clean">I-Link Clean</option>
            <option value="general">General Community</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No community reports match your filters" />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Link key={r.id} href={`/app/reports/${r.id}`} className="block">
              <Card className="hover:border-blue-300 transition-colors">
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {r.reference_code}
                      </span>
                      <Badge tone={r.module === 'clean' ? 'teal' : 'blue'}>
                        {humanize(r.module)} · {humanize(r.category)}
                      </Badge>
                      <PriorityBadge priority={r.priority} />
                      <StatusBadge status={r.status} />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                      <Sparkles className="h-3 w-3" />
                      Score: {r.priority_score}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{r.title}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {r.location_text} · {r.reporter?.full_name || 'Resident'} ·{' '}
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    {r.assignee && (
                      <Badge tone="teal">Assigned: {r.assignee.full_name}</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
