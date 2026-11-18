'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { STATUS_ORDER, formatDateTime, humanize } from '@/lib/format';
import {
  EMERGENCY_CATEGORIES,
  type EmergencyReport,
} from '@/lib/types';
import { Badge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function ManageEmergencyPage() {
  const [items, setItems] = useState<EmergencyReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [assignedMe, setAssignedMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<EmergencyReport[]>('/emergency', {
        query: {
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          assigned: assignedMe ? 'me' : undefined,
        },
      });
      setItems(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, assignedMe]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('emergency:new', () => load());
  useRealtimeEvent('emergency:updated', () => load());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Emergency Triage &amp; Dispatch Queue
            </h1>
            <p className="text-xs text-slate-600">
              Sorted by AI priority score and submission time
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
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

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Categories</option>
            {EMERGENCY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={assignedMe}
              onChange={(e) => setAssignedMe(e.target.checked)}
            />
            Assigned to me
          </label>
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
        <EmptyState title="No emergency reports match your filters" />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Link key={r.id} href={`/app/emergency/${r.id}`} className="block">
              <Card className="hover:border-red-300 transition-colors">
                <CardBody className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {r.reference_code}
                      </span>
                      <Badge tone="red">{humanize(r.category)}</Badge>
                      <PriorityBadge priority={r.priority} />
                      <StatusBadge status={r.status} />
                      {r.people_affected !== null && (
                        <Badge tone="amber">{r.people_affected} affected</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-800">
                        <Sparkles className="h-3 w-3" />
                        AI Score: {r.priority_score}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{r.title}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {r.location_text} · Reported by {r.reporter?.full_name || 'Resident'} ·{' '}
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    {r.assignee && (
                      <Badge tone="teal">Assigned: {r.assignee.full_name}</Badge>
                    )}
                  </div>

                  {r.priority_reasons && r.priority_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.priority_reasons.map((reason, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
