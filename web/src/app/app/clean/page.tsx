'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Leaf, Plus, Recycle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize, timeAgo } from '@/lib/format';
import {
  CLEAN_CATEGORIES,
  type CleanSummary,
  type CommunityReport,
} from '@/lib/types';
import { Badge, PriorityBadge, StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ImageUpload } from '@/components/ImageUpload';
import { LocationPicker } from '@/components/MapView';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function CleanModulePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [summary, setSummary] = useState<CleanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [category, setCategory] = useState<(typeof CLEAN_CATEGORIES)[number]>(
    'garbage_accumulation',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(14.6515);
  const [longitude, setLongitude] = useState<number | null>(121.0493);
  const [isPublic, setIsPublic] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<CleanSummary>('/clean/summary');
      setSummary(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('module', 'clean');
      fd.append('category', category);
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('locationText', locationText.trim());
      fd.append('isPublic', String(isPublic));
      if (latitude !== null && longitude !== null) {
        fd.append('latitude', String(latitude));
        fd.append('longitude', String(longitude));
      }
      if (image) {
        fd.append('image', image);
      }

      const created = await api<CommunityReport>('/reports', {
        method: 'POST',
        body: fd,
      });

      toast({
        title: `I-Link Clean report submitted (${created.reference_code})`,
        description: 'Logged for barangay sanitation & environmental action.',
        variant: 'success',
      });
      setModalOpen(false);
      router.push(`/app/reports/${created.id}`);
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: errorMessage(err),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorState message={error || 'Unable to load I-Link Clean'} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#0F766E] to-emerald-700 p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">I-Link Clean · Environmental &amp; Sanitation</h1>
            <p className="text-xs text-teal-100 mt-0.5">
              Report solid waste accumulation, clogged drainage canals, illegal dumping, and
              pollution
            </p>
          </div>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-white text-teal-900 hover:bg-teal-50"
        >
          <Plus className="h-4 w-4" />
          Report Environmental Issue
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Total Clean Reports</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Open / For Cleanup</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{summary.open}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Resolved All-Time</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.resolved}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Cleared Last 30 Days</p>
            <p className="text-2xl font-bold text-teal-700 mt-1">{summary.resolved_last_30d}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Recycle className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">Breakdown by Category</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {summary.by_category.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-slate-800">{humanize(item.key)}</span>
                <Badge tone="teal">{item.count}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent I-Link Clean Reports
            </h2>
          </CardHeader>
          <CardBody>
            {summary.recent.length === 0 ? (
              <EmptyState title="No sanitation reports yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.recent.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/reports/${r.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">
                          {r.reference_code}
                        </span>
                        <Badge tone="teal">{humanize(r.category)}</Badge>
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.location_text} · {timeAgo(r.created_at)}
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

      {/* Modal Form */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Submit I-Link Clean Environmental Report"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Environmental Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CLEAN_CATEGORIES)[number])}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {CLEAN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              minLength={4}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clogged drainage canal causing street overflow after rain"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              required
              minLength={10}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the waste volume, odor, drainage blockage, or environmental risk…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Location / Purok / Landmark *
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="e.g. Corner Sampaguita St., Purok 4"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            height="220px"
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <ImageUpload file={image} onChange={setImage} />

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Show anonymized pin on public Community GIS Map
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={submitting}>
              <CheckCircle2 className="h-4 w-4" />
              Submit Clean Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
