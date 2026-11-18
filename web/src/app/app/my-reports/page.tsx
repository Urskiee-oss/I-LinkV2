'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Flame, Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { formatDateTime, humanize } from '@/lib/format';
import type { CommunityReport, EmergencyReport } from '@/lib/types';
import { Badge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function MyReportsPage() {
  const [emergencies, setEmergencies] = useState<EmergencyReport[]>([]);
  const [community, setCommunity] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [em, rep] = await Promise.all([
        api<EmergencyReport[]>('/emergency/mine'),
        api<CommunityReport[]>('/reports/mine'),
      ]);
      setEmergencies(em);
      setCommunity(rep);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('emergency:updated', () => load());
  useRealtimeEvent('report:updated', () => load());

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Submitted Reports</h1>
          <p className="text-xs text-slate-600">
            Track real-time dispatch and resolution progress for your reports
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/emergency/new">
            <Button variant="danger" size="sm">
              <Flame className="h-4 w-4" />
              Report Emergency
            </Button>
          </Link>
          <Link href="/app/reports/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Community Report
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              My Emergency Reports ({emergencies.length})
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          {emergencies.length === 0 ? (
            <EmptyState
              title="No emergency reports"
              description="You have not submitted any emergency reports."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {emergencies.map((r) => (
                <Link
                  key={r.id}
                  href={`/app/emergency/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50 px-2 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{r.reference_code}</span>
                      <Badge tone="red">{humanize(r.category)}</Badge>
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.location_text} · {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              My Community &amp; I-Link Clean Reports ({community.length})
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          {community.length === 0 ? (
            <EmptyState
              title="No community reports"
              description="Submit a community or I-Link Clean report to track it here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {community.map((r) => (
                <Link
                  key={r.id}
                  href={`/app/reports/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50 px-2 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{r.reference_code}</span>
                      <Badge tone={r.module === 'clean' ? 'teal' : 'blue'}>
                        {humanize(r.module)} · {humanize(r.category)}
                      </Badge>
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.location_text} · {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
