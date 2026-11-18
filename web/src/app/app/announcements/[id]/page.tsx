'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pin } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import type { Announcement } from '@/lib/types';
import { Badge, PriorityBadge } from '@/components/Badge';
import { Card, CardBody } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<Announcement>(`/announcements/${id}`);
      setItem(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error || !item) {
    return <ErrorState message={error || 'Announcement not found'} onRetry={load} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/app/announcements"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All Announcements
      </Link>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {item.is_pinned && (
              <Badge tone="blue">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            <PriorityBadge priority={item.priority} />
            <Badge tone="slate">{humanize(item.category)}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{item.title}</h1>
          <p className="text-xs text-slate-500">
            Published {formatDateTime(item.published_at)}
            {item.author && ` · ${item.author.full_name}`}
          </p>
          {item.summary && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs font-medium text-slate-700">
              {item.summary}
            </div>
          )}
          <div className="prose prose-sm max-w-none text-sm text-slate-800 whitespace-pre-wrap leading-relaxed pt-2">
            {item.body}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
