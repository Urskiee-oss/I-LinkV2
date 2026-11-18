'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, PhoneCall } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  EMERGENCY_CATEGORIES,
  type EmergencyCategory,
  type EmergencyReport,
} from '@/lib/types';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ImageUpload } from '@/components/ImageUpload';
import { LocationPicker } from '@/components/MapView';
import { useToast } from '@/components/Toast';

export default function NewEmergencyPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [category, setCategory] = useState<EmergencyCategory>('fire');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [peopleAffected, setPeopleAffected] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(14.6515);
  const [longitude, setLongitude] = useState<number | null>(121.0493);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('locationText', locationText.trim());
      if (latitude !== null && longitude !== null) {
        fd.append('latitude', String(latitude));
        fd.append('longitude', String(longitude));
      }
      if (peopleAffected && Number(peopleAffected) > 0) {
        fd.append('peopleAffected', String(Number(peopleAffected)));
      }
      if (image) {
        fd.append('image', image);
      }

      const created = await api<EmergencyReport>('/emergency', {
        method: 'POST',
        body: fd,
      });

      toast({
        title: `Emergency dispatched (${created.reference_code})`,
        description: `Priority ${created.priority.toUpperCase()} · Barangay responders have been alerted.`,
        variant: 'warning',
      });
      router.push(`/app/emergency/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <PhoneCall className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="text-xs text-red-900">
          <p className="font-bold">Life-Threatening Emergency?</p>
          <p className="mt-0.5">
            Call <strong>911</strong>, <strong>BFP 160</strong>, or <strong>PNP 117</strong>{' '}
            immediately. Submitting this form alerts Barangay DRRM Responders and Tanods in real
            time.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                I-Link Emergency Incident Report
              </h1>
              <p className="text-xs text-slate-500">
                Automatic AI priority triage scores severity and dispatches barangay responders
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EmergencyCategory)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
                >
                  {EMERGENCY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated People Affected (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Incident Summary / Title *
              </label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Residential electrical fire along Purok 3 Riverside"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Situation &amp; Hazards *
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe visible hazards, trapped individuals, injuries, or access landmarks…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Exact Purok / Street / Landmark *
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Near Purok 3 Covered Court, beside Sari-Sari Store"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
              />
            </div>

            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Photo Evidence (optional)
              </label>
              <ImageUpload file={image} onChange={setImage} />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={submitting}>
                <Flame className="h-4 w-4" />
                Dispatch Emergency Report
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
