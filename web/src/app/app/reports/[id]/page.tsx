'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Sparkles, UserCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRealtimeEvent } from '@/lib/realtime';
import { STATUS_ORDER, formatDateTime, humanize } from '@/lib/format';
import type { CommunityReport, PersonRef, ReportStatus } from '@/lib/types';
import { Badge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { MapView } from '@/components/MapView';
import { Skeleton } from '@/components/Skeleton';
import { StatusStepper } from '@/components/StatusStepper';
import { useToast } from '@/components/Toast';

export default function CommunityReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isStaff = hasRole('admin', 'responder');
  const isAdmin = hasRole('admin');

  const [report, setReport] = useState<CommunityReport | null>(null);
  const [responders, setResponders] = useState<PersonRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState<ReportStatus>('under_review');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<CommunityReport>(`/reports/${id}`);
      setReport(data);
      setNextStatus(data.status);
      setAssigneeId(data.assigned_to ?? '');
      if (isAdmin) {
        const resp = await api<PersonRef[]>('/users/responders');
        setResponders(resp);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('report:updated', (updated) => {
    if (updated.id === id) load();
  });

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingStatus(true);
    try {
      await api(`/reports/${id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus, note: statusNote.trim() || undefined },
      });
      setStatusNote('');
      toast({ title: 'Report status updated', variant: 'success' });
      await load();
    } catch (err) {
      toast({ title: 'Update failed', description: errorMessage(err), variant: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api(`/reports/${id}/notes`, {
        method: 'POST',
        body: { note: noteText.trim(), isInternal },
      });
      setNoteText('');
      setIsInternal(false);
      toast({ title: 'Note added', variant: 'success' });
      await load();
    } catch (err) {
      toast({ title: 'Failed to add note', description: errorMessage(err), variant: 'error' });
    } finally {
      setAddingNote(false);
    }
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await api(`/reports/${id}/assign`, {
        method: 'PATCH',
        body: { assigneeId: assigneeId || null },
      });
      toast({ title: 'Responder assignment saved', variant: 'success' });
      await load();
    } catch (err) {
      toast({ title: 'Assignment failed', description: errorMessage(err), variant: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return <ErrorState message={error || 'Community report not found'} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={isStaff ? '/app/manage/reports' : '/app/my-reports'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reports
        </Link>
        <span className="font-mono text-xs font-semibold text-slate-500">
          {report.reference_code}
        </span>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.module === 'clean' ? 'teal' : 'blue'}>
                  {humanize(report.module)} · {humanize(report.category)}
                </Badge>
                <PriorityBadge priority={report.priority} />
                <StatusBadge status={report.status} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 pt-1">{report.title}</h1>
              <p className="text-xs text-slate-500">
                Submitted {formatDateTime(report.created_at)}
                {report.reporter && ` by ${report.reporter.full_name}`}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                AI Priority Score
              </p>
              <p className="text-lg font-bold text-slate-900">{report.priority_score} / 100</p>
            </div>
          </div>

          <StatusStepper status={report.status} />
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-900">Report Details</h2>
            </CardHeader>
            <CardBody className="space-y-4 text-sm text-slate-700">
              <p className="whitespace-pre-wrap leading-relaxed">{report.description}</p>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <MapPin className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Location</p>
                  <p>{report.location_text}</p>
                </div>
              </div>

              {report.latitude !== null && report.longitude !== null && (
                <MapView
                  height="240px"
                  center={[report.latitude, report.longitude]}
                  markers={[
                    {
                      id: report.id,
                      latitude: report.latitude,
                      longitude: report.longitude,
                      color: report.module === 'clean' ? '#0F766E' : '#1E40AF',
                      title: report.title,
                      subtitle: report.location_text,
                      badge: humanize(report.category),
                    },
                  ]}
                />
              )}

              {report.attachments && report.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Photo Evidence</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {report.attachments.map((att) =>
                      att.url ? (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-xl border border-slate-200"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.url}
                            alt={att.file_name}
                            className="h-48 w-full object-cover"
                          />
                        </a>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {report.priority_reasons && report.priority_reasons.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-700" />
                  <h2 className="text-sm font-semibold text-slate-900">AI Triage Reasons</h2>
                </div>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                  {report.priority_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-900">Status &amp; Activity History</h2>
            </CardHeader>
            <CardBody>
              {!report.updates || report.updates.length === 0 ? (
                <p className="text-xs text-slate-500">No updates yet.</p>
              ) : (
                <ol className="space-y-3">
                  {report.updates.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-xl border border-slate-200 p-3 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {u.author?.full_name || 'Barangay Staff'}
                          </span>
                          {u.to_status && <StatusBadge status={u.to_status} />}
                          {u.is_internal && <Badge tone="purple">Internal</Badge>}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(u.created_at)}
                        </span>
                      </div>
                      {u.note && <p className="text-slate-700 pt-1">{u.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-900">Assigned Staff</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-xs">
              {report.assignee ? (
                <div className="rounded-xl bg-teal-50/70 border border-teal-200 p-3">
                  <p className="font-semibold text-teal-950">{report.assignee.full_name}</p>
                </div>
              ) : (
                <p className="text-slate-500">Not yet assigned to a specific responder.</p>
              )}

              {isAdmin && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block font-semibold text-slate-700">Assign Staff</label>
                  <div className="flex gap-2">
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="">— Unassigned —</option>
                      {responders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={handleAssign} loading={assigning}>
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {isStaff && (
            <>
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-slate-900">Update Status</h2>
                </CardHeader>
                <CardBody>
                  <form onSubmit={handleStatusUpdate} className="space-y-3">
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as ReportStatus)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={3}
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Add resolution or action note…"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                    <Button type="submit" size="sm" loading={updatingStatus} className="w-full">
                      Save Status
                    </Button>
                  </form>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-slate-900">Add Note</h2>
                </CardHeader>
                <CardBody>
                  <form onSubmit={handleAddNote} className="space-y-3">
                    <textarea
                      rows={3}
                      required
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write staff note…"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                      />
                      Internal staff note
                    </label>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      loading={addingNote}
                      className="w-full"
                    >
                      Post Note
                    </Button>
                  </form>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
