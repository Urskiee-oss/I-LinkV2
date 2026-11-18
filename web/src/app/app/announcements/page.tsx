'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, Pin } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { formatDateTime, humanize } from '@/lib/format';
import type { Announcement } from '@/lib/types';
import { Badge, PriorityBadge } from '@/components/Badge';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<Announcement[]>('/announcements');
      setItems(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('announcement:new', () => load());

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">I-Link Access · Barangay Advisories</h1>
          <p className="text-xs text-slate-600">
            Official announcements, public health schedules, and disaster preparedness notices
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No published announcements" />
      ) : (
        <div className="space-y-3.5">
          {items.map((a) => (
            <Link key={a.id} href={`/app/announcements/${a.id}`} className="block">
              <Card className="hover:border-blue-300 transition-colors">
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.is_pinned && (
                        <Badge tone="blue">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </Badge>
                      )}
                      <PriorityBadge priority={a.priority} />
                      <Badge tone="slate">{humanize(a.category)}</Badge>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(a.published_at)}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{a.title}</h2>
                  <p className="text-xs text-slate-600 line-clamp-2">{a.summary || a.body}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
