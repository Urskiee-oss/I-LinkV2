'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, HeartHandshake, MapPin, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useRealtimeEvent } from '@/lib/realtime';
import { formatDateTime, humanize } from '@/lib/format';
import type { CommunityActivity, VolunteerRegistration } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function BayanihanPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [activities, setActivities] = useState<CommunityActivity[]>([]);
  const [myRegs, setMyRegs] = useState<VolunteerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<CommunityActivity | null>(null);
  const [skills, setSkills] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [acts, regs] = await Promise.all([
        api<CommunityActivity[]>('/activities'),
        api<VolunteerRegistration[]>('/activities/me/registrations'),
      ]);
      setActivities(acts);
      setMyRegs(regs);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('activity:updated', () => load());

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      await api(`/activities/${selectedActivity.id}/register`, {
        method: 'POST',
        body: {
          skills: skills.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast({
        title: 'Registered for Bayanihan activity!',
        description: selectedActivity.title,
        variant: 'success',
      });
      setSelectedActivity(null);
      setSkills('');
      setNotes('');
      await load();
    } catch (err) {
      toast({
        title: 'Registration failed',
        description: errorMessage(err),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (activityId: string) => {
    try {
      await api(`/activities/${activityId}/register`, { method: 'DELETE' });
      toast({ title: 'Volunteer registration cancelled', variant: 'info' });
      await load();
    } catch (err) {
      toast({
        title: 'Could not cancel registration',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              I-Link Bayanihan · Civic Participation &amp; Volunteerism
            </h1>
            <p className="text-xs text-slate-600">
              Sign up for barangay cleanups, disaster preparedness drills, and community programs
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'all' ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Activities ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'mine' ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Registrations ({myRegs.filter((r) => r.status !== 'cancelled').length})
          </button>
        </div>
      </div>

      {tab === 'all' ? (
        activities.length === 0 ? (
          <EmptyState title="No Bayanihan activities found" />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {activities.map((act) => {
              const myReg = act.my_registration;
              const isRegistered = myReg && myReg.status !== 'cancelled';
              const full =
                act.max_participants !== null && act.registered_count >= act.max_participants;

              return (
                <Card key={act.id} className="flex flex-col justify-between">
                  <CardBody className="space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone="teal">{humanize(act.activity_type)}</Badge>
                          <Badge
                            tone={
                              act.status === 'upcoming'
                                ? 'blue'
                                : act.status === 'ongoing'
                                  ? 'emerald'
                                  : 'slate'
                            }
                          >
                            {humanize(act.status)}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {act.registered_count}
                          {act.max_participants ? ` / ${act.max_participants}` : ''} volunteers
                        </span>
                      </div>

                      <h2 className="text-base font-bold text-slate-900">{act.title}</h2>
                      <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDateTime(act.starts_at)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {act.location_text}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        {isRegistered ? (
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              Registered ({humanize(myReg.status)})
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(act.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            disabled={
                              full || act.status === 'completed' || act.status === 'cancelled'
                            }
                            onClick={() => setSelectedActivity(act)}
                          >
                            {full ? 'Slots Full' : 'Volunteer / Join'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      ) : myRegs.length === 0 ? (
        <EmptyState
          title="No volunteer registrations yet"
          description="Join an upcoming Bayanihan activity to participate in community programs."
        />
      ) : (
        <div className="space-y-3">
          {myRegs.map((reg) => (
            <Card key={reg.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        reg.status === 'attended'
                          ? 'emerald'
                          : reg.status === 'cancelled'
                            ? 'slate'
                            : 'blue'
                      }
                    >
                      {humanize(reg.status)}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {reg.activity ? formatDateTime(reg.activity.starts_at) : ''}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {reg.activity?.title || 'Community Activity'}
                  </p>
                  {reg.activity?.location_text && (
                    <p className="text-xs text-slate-500">{reg.activity.location_text}</p>
                  )}
                </div>
                {reg.status !== 'cancelled' && reg.status !== 'attended' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(reg.activity_id)}
                  >
                    Cancel Registration
                  </Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        title={`Volunteer for: ${selectedActivity?.title ?? ''}`}
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Relevant Skills / Equipment (optional)
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. First Aid, Carpentry, Logistics, Clearing Tools"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes for Barangay Organizer (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Availability or team notes…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedActivity(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Confirm Volunteer Registration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
