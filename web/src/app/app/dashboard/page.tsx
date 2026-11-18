'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Waves,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { formatNumber, formatShortDay, humanize, timeAgo } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { Badge, FloodTierBadge, StatusBadge } from '@/components/Badge';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function IntelligenceDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<DashboardStats>('/dashboard/stats');
      setStats(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('dashboard:refresh', () => load());
  useRealtimeEvent('emergency:new', () => load());
  useRealtimeEvent('emergency:updated', () => load());
  useRealtimeEvent('report:new', () => load());
  useRealtimeEvent('report:updated', () => load());
  useRealtimeEvent('flood:alert', () => load());

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <ErrorState
        message={error || 'Unable to load Community Intelligence Dashboard'}
        onRetry={load}
      />
    );
  }

  const timelineData = stats.timeline.map((pt) => ({
    ...pt,
    label: formatShortDay(pt.date),
  }));

  const categoryChartData = [
    ...stats.emergency_by_category.map((c) => ({
      name: humanize(c.key),
      count: c.count,
      type: 'Emergency',
    })),
    ...stats.community_by_category.map((c) => ({
      name: humanize(c.key),
      count: c.count,
      type: 'Community',
    })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Community Intelligence Dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time operational metrics, flood telemetry, and rule-based spatial/trend analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/manage/emergency"
            className="rounded-lg bg-[#DC2626] px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Emergency Queue ({stats.totals.emergency_reports})
          </Link>
          <Link
            href="/app/manage/reports"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reports Queue
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Open / Pending Reports</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatNumber(stats.totals.pending_reports)}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                {stats.insights.high_priority_open} high/critical priority open
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Emergency Incidents</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatNumber(stats.totals.emergency_reports)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Avg resolution:{' '}
                {stats.insights.avg_resolution_hours !== null
                  ? `${stats.insights.avg_resolution_hours}h`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
              <Flame className="h-5 w-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Resolved Cases</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatNumber(stats.totals.resolved_reports)}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Out of {formatNumber(stats.totals.total_reports)} total reports
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Residents &amp; Volunteers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatNumber(stats.totals.residents)}
              </p>
              <p className="text-[11px] text-teal-700 mt-1">
                {formatNumber(stats.totals.volunteer_registrations)} Bayanihan sign-ups
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Flood Early Warning Summary Banner */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  IoT Flood Early Warning Status
                </span>
                <FloodTierBadge tier={stats.flood.highest_tier} />
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {stats.flood.sensors} sensors online · {stats.flood.active_alerts_24h} alert
                escalations in the last 24 hours
              </p>
            </div>
          </div>
          <Link
            href="/app/flood"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Open Flood Telemetry Console →
          </Link>
        </CardBody>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                14-Day Incident &amp; Community Report Volume
              </h2>
              <p className="text-xs text-slate-500">Daily submissions (Manila time)</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="emergency"
                    name="Emergency"
                    stroke="#DC2626"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="community"
                    name="Community & Clean"
                    stroke="#0F766E"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Top Reported Categories</h2>
              <p className="text-xs text-slate-500">Emergency &amp; community breakdown</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Reports" fill="#1E40AF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Rule-Based AI Community Intelligence Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Rule-Based Community Intelligence Insights
              </h2>
              <p className="text-xs text-slate-500">{stats.insights.method}</p>
            </div>
          </div>
          <Badge tone="blue">Deterministic Analytics</Badge>
        </CardHeader>
        <CardBody className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Geographic Report Hotspots (~220m Grid)
            </h3>
            {stats.insights.hotspots.length === 0 ? (
              <p className="text-xs text-slate-500">No spatial clusters detected yet.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.insights.hotspots.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{h.label}</p>
                      <p className="text-[11px] text-slate-500">
                        Top issue: {humanize(h.top_category)} · ({h.latitude.toFixed(4)},{' '}
                        {h.longitude.toFixed(4)})
                      </p>
                    </div>
                    <Badge tone="orange">{h.count} reports</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              30-Day Recurring Issue Trends
            </h3>
            {stats.insights.recurring.length === 0 ? (
              <p className="text-xs text-slate-500">No 30-day trend data available.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.insights.recurring.map((r) => {
                  const up = r.change_vs_prev_30d > 0;
                  return (
                    <div
                      key={r.category}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {humanize(r.category)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {r.count_last_30d} reports in last 30 days
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          up ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {up ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {up ? `+${r.change_vs_prev_30d}%` : `${r.change_vs_prev_30d}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Status Distribution & Recent Activity Feed */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Reports by Status</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {stats.reports_by_status.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5"
              >
                <StatusBadge status={s.key} />
                <span className="text-sm font-bold text-slate-900">{s.count}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">Live Barangay Activity Stream</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-slate-100">
              {stats.recent_activity.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.link}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          item.kind === 'emergency'
                            ? 'red'
                            : item.kind === 'flood_alert'
                              ? 'orange'
                              : item.kind === 'announcement'
                                ? 'blue'
                                : 'teal'
                        }
                      >
                        {humanize(item.kind)}
                      </Badge>
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {item.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status && <StatusBadge status={item.status} />}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
