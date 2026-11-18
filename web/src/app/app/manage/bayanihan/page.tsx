'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, HeartHandshake, Plus, Trash2, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, fromManilaInput, humanize, toManilaInput } from '@/lib/format';
import {
  ACTIVITY_TYPES,
  type ActivityStatus,
  type ActivityType,
  type CommunityActivity,
  type RegistrationStatus,
  type VolunteerRegistration,
} from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function ManageBayanihanPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CommunityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityActivity | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('environmental');
  const [locationText, setLocationText] = useState('');
  const [startsAtInput, setStartsAtInput] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('50');
  const [status, setStatus] = useState<ActivityStatus>('upcoming');
  const [saving, setSaving] = useState(false);

  // Participants modal
  const [rosterActivity, setRosterActivity] = useState<CommunityActivity | null>(null);
  const [participants, setParticipants] = useState<VolunteerRegistration[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<CommunityActivity[]>('/activities');
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

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setActivityType('environmental');
    setLocationText('Barangay Covered Court');
    const tomorrow = new Date(Date.now() + 86400 * 1000).toISOString();
    setStartsAtInput(toManilaInput(tomorrow));
    setMaxParticipants('50');
    setStatus('upcoming');
    setModalOpen(true);
  };

  const openEdit = (act: CommunityActivity) => {
    setEditing(act);
    setTitle(act.title);
    setDescription(act.description);
    setActivityType(act.activity_type);
    setLocationText(act.location_text);
    setStartsAtInput(toManilaInput(act.starts_at));
    setMaxParticipants(act.max_participants !== null ? String(act.max_participants) : '');
    setStatus(act.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = fromManilaInput(startsAtInput);
    if (!startsAt) {
      toast({ title: 'Invalid start date/time', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        activityType,
        locationText: locationText.trim(),
        startsAt,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        status,
        isVolunteerOpportunity: true,
      };
      if (editing) {
        await api(`/activities/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Activity updated', variant: 'success' });
      } else {
        await api('/activities', { method: 'POST', body: payload });
        toast({ title: 'Bayanihan activity created', variant: 'success' });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/activities/${id}`, { method: 'DELETE' });
      toast({ title: 'Activity deleted', variant: 'info' });
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: errorMessage(err), variant: 'error' });
    }
  };

  const openRoster = async (act: CommunityActivity) => {
    setRosterActivity(act);
    setLoadingRoster(true);
    try {
      const res = await api<VolunteerRegistration[]>(`/activities/${act.id}/participants`);
      setParticipants(res);
    } catch (err) {
      toast({ title: 'Failed to load roster', description: errorMessage(err), variant: 'error' });
    } finally {
      setLoadingRoster(false);
    }
  };

  const updateRegistrationStatus = async (regId: string, newStatus: RegistrationStatus) => {
    try {
      await api(`/activities/registrations/${regId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setParticipants((prev) =>
        prev.map((p) => (p.id === regId ? { ...p, status: newStatus } : p)),
      );
      toast({ title: `Volunteer marked ${humanize(newStatus)}`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Update failed', description: errorMessage(err), variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage Bayanihan Activities</h1>
            <p className="text-xs text-slate-600">
              Schedule civic events and manage volunteer attendance rosters
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Activity
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No Bayanihan activities scheduled" />
      ) : (
        <div className="space-y-3">
          {items.map((act) => (
            <Card key={act.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Badge tone="teal">{humanize(act.activity_type)}</Badge>
                    <Badge tone="blue">{humanize(act.status)}</Badge>
                    <span className="text-xs text-slate-500">
                      {act.registered_count}
                      {act.max_participants ? ` / ${act.max_participants}` : ''} volunteers
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 pt-1">{act.title}</h2>
                  <p className="text-xs text-slate-600">
                    {formatDateTime(act.starts_at)} · {act.location_text}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openRoster(act)}>
                    <Users className="h-3.5 w-3.5" />
                    Participants ({act.registered_count})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(act)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(act.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Bayanihan Activity' : 'Create Bayanihan Activity'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Activity Type</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description *</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Start Date &amp; Time (Manila) *
              </label>
              <input
                type="datetime-local"
                required
                value={startsAtInput}
                onChange={(e) => setStartsAtInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Slots</label>
              <input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Location *</label>
            <input
              type="text"
              required
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Activity
            </Button>
          </div>
        </form>
      </Modal>

      {/* Roster Modal */}
      <Modal
        open={Boolean(rosterActivity)}
        onClose={() => setRosterActivity(null)}
        title={`Volunteer Roster: ${rosterActivity?.title ?? ''}`}
        maxWidth="xl"
      >
        {loadingRoster ? (
          <Skeleton className="h-32 w-full" />
        ) : participants.length === 0 ? (
          <EmptyState title="No volunteers registered for this activity yet" />
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {participants.map((p) => (
              <div
                key={p.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {p.user?.full_name || 'Resident'}
                  </p>
                  <p className="text-slate-500">
                    {p.user?.purok || 'No purok'} · {p.user?.phone || p.user?.email || ''}
                  </p>
                  {p.skills && <p className="text-teal-700 mt-0.5">Skills: {p.skills}</p>}
                </div>
                <select
                  value={p.status}
                  onChange={(e) =>
                    updateRegistrationStatus(p.id, e.target.value as RegistrationStatus)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="registered">Registered</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="attended">Attended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
