'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  CLEAN_CATEGORIES,
  GENERAL_CATEGORIES,
  type CommunityCategory,
  type CommunityReport,
  type ReportModule,
} from '@/lib/types';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ImageUpload } from '@/components/ImageUpload';
import { LocationPicker } from '@/components/MapView';
import { useToast } from '@/components/Toast';

export default function NewCommunityReportPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [module, setModule] = useState<ReportModule>('general');
  const [category, setCategory] = useState<CommunityCategory>('streetlight');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(14.6515);
  const [longitude, setLongitude] = useState<number | null>(121.0493);
  const [isPublic, setIsPublic] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = module === 'clean' ? CLEAN_CATEGORIES : GENERAL_CATEGORIES;

  const handleModuleChange = (m: ReportModule) => {
    setModule(m);
    setCategory(m === 'clean' ? CLEAN_CATEGORIES[0] : GENERAL_CATEGORIES[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('module', module);
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
        title: `Report submitted (${created.reference_code})`,
        description: 'Barangay staff have received your report.',
        variant: 'success',
      });
      router.push(`/app/reports/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Submit Community Report</h1>
              <p className="text-xs text-slate-500">
                Report municipal infrastructure, streetlighting, accessibility, or sanitation
                issues
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Report Module *
                </label>
                <select
                  value={module}
                  onChange={(e) => handleModuleChange(e.target.value as ReportModule)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="general">General Community Issue</option>
                  <option value="clean">I-Link Clean (Environmental &amp; Sanitation)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CommunityCategory)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                required
                minLength={4}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Broken LED streetlight along Kalayaan Alley"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Description *
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide clear details so barangay maintenance staff can locate and resolve the issue…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purok / Street / Landmark *
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Purok 2 Pag-asa, in front of Daycare Center"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                Photo Attachment (optional)
              </label>
              <ImageUpload file={image} onChange={setImage} />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Display anonymized pin on public Community GIS Map
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Submit Community Report
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
