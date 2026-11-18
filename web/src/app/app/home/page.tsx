'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  Calendar,
  FileText,
  Flame,
  Leaf,
  MapPin,
  Megaphone,
  Waves,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRealtimeEvent } from '@/lib/realtime';
import { formatDate, formatDateTime, greeting, humanize, timeAgo } from '@/lib/format';
import type { ResidentDashboard } from '@/lib/types';
import { Badge, FloodTierBadge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function ResidentHomePage() {
  const { me } = useAuth();
  const [data, setData] = useState<ResidentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<ResidentDashboard>('/dashboard/resident');
      setData(res);
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
  useRealtimeEvent('emergency:updated', () => load());
  useRealtimeEvent('report:updated', () => load());
  useRealtimeEvent('flood:reading', () => load());
  useRealtimeEvent('flood:alert', () => load());

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid sm:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error || 'Unable to load resident home'} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      {/* Greeting Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E40AF] to-[#0F766E] p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-100">{greeting()},</p>
          <h1 className="text-2xl font-bold mt-0.5">{me?.profile.full_name}</h1>
          <p className="text-xs text-blue-100 mt-1">
            {me?.profile.purok || 'Barangay Resident'} · Report emergencies, check flood levels,
            and stay updated with official advisories.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/app/emergency/new">
            <Button variant="danger" size="md">
              <Flame className="h-4 w-4" />
              Report Emergency
            </Button>
          </Link>
          <Link href="/app/ai">
            <Button
              variant="outline"
              size="md"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20"
            >
              <Bot className="h-4 w-4" />
              Ask I-Link AI
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Link
          href="/app/emergency/new"
          className="rounded-xl border border-red-200 bg-red-50/70 p-4 hover:bg-red-50 transition-colors"
        >
          <Flame className="h-5 w-5 text-red-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Emergency Dispatch</p>
          <p className="text-xs text-slate-600 mt-0.5">Fire, medical, crime, flood rescue</p>
        </Link>
        <Link
          href="/app/reports/new"
          className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 transition-colors"
        >
          <FileText className="h-5 w-5 text-blue-700" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Community Issue</p>
          <p className="text-xs text-slate-600 mt-0.5">Streetlight, road damage, noise</p>
        </Link>
        <Link
          href="/app/clean"
          className="rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-300 transition-colors"
        >
          <Leaf className="h-5 w-5 text-teal-700" />
          <p className="mt-2 text-sm font-semibold text-slate-900">I-Link Clean</p>
          <p className="text-xs text-slate-600 mt-0.5">Sanitation, clogged canal, waste</p>
        </Link>
        <Link
          href="/app/map"
          className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 transition-colors"
        >
          <MapPin className="h-5 w-5 text-indigo-700" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Evacuation &amp; GIS Map</p>
          <p className="text-xs text-slate-600 mt-0.5">Find nearest safe shelter &amp; sensors</p>
        </Link>
      </div>

      {/* Flood Status Strip */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Barangay Waterway Flood Telemetry
                </p>
                <FloodTierBadge tier={data.flood.highest_tier} />
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {data.flood.sensors.length} active ultrasonic sensors monitoring creek &amp; bridge
                water levels
              </p>
            </div>
          </div>
          <Link href="/app/flood">
            <Button variant="outline" size="sm">
              View Live Sensors →
            </Button>
          </Link>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* My Recent Reports */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">My Submitted Reports</h2>
              <p className="text-xs text-slate-500">
                {data.my_reports.total} total · {data.my_reports.open} open ·{' '}
                {data.my_reports.resolved} resolved
              </p>
            </div>
            <Link href="/app/my-reports" className="text-xs font-semibold text-blue-700 hover:underline">
              See all →
            </Link>
          </CardHeader>
          <CardBody>
            {data.recent_reports.length === 0 ? (
              <EmptyState
                title="No reports submitted yet"
                description="When you submit an emergency or community report, its live status will appear here."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recent_reports.map((r) => {
                  const href =
                    r.kind === 'emergency' ? `/app/emergency/${r.id}` : `/app/reports/${r.id}`;
                  return (
                    <Link
                      key={`${r.kind}-${r.id}`}
                      href={href}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-500">
                            {r.reference_code}
                          </span>
                          <Badge tone={r.kind === 'emergency' ? 'red' : 'teal'}>
                            {r.kind === 'emergency' ? 'Emergency' : humanize(r.module)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                          {r.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Updated {timeAgo(r.updated_at)}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Official Announcements */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">I-Link Access Advisories</h2>
            </div>
            <Link
              href="/app/announcements"
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardBody>
            {data.announcements.length === 0 ? (
              <EmptyState title="No announcements" />
            ) : (
              <div className="space-y-3">
                {data.announcements.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/announcements/${a.id}`}
                    className="block rounded-xl border border-slate-200 p-3.5 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <PriorityBadge priority={a.priority} />
                      <span className="text-[11px] text-slate-400">
                        {formatDate(a.published_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-slate-900">{a.title}</p>
                    {a.summary && (
                      <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{a.summary}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Upcoming Bayanihan Activities */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Upcoming I-Link Bayanihan Activities
              </h2>
              <p className="text-xs text-slate-500">
                You have {data.my_registrations} active volunteer registration(s)
              </p>
            </div>
          </div>
          <Link
            href="/app/bayanihan"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Explore Bayanihan →
          </Link>
        </CardHeader>
        <CardBody>
          {data.upcoming_activities.length === 0 ? (
            <EmptyState title="No upcoming activities scheduled" />
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {data.upcoming_activities.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <Badge tone="teal">{humanize(act.activity_type)}</Badge>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">{act.title}</h3>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{act.description}</p>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                    <p>{formatDateTime(act.starts_at)}</p>
                    <p className="truncate">{act.location_text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
