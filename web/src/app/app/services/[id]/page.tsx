'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, Clock, ListOrdered, MapPin, Phone } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import type { BarangayService } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [service, setService] = useState<BarangayService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<BarangayService>(`/services/${id}`);
      setService(res);
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

  if (error || !service) {
    return <ErrorState message={error || 'Service not found'} onRetry={load} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/app/services"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Services Directory
      </Link>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="blue">{humanize(service.category)}</Badge>
            {service.fee && (
              <Badge tone="emerald">Fee: {service.fee}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{service.name}</h1>
          <p className="text-sm text-slate-700 leading-relaxed">{service.description}</p>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <p className="text-slate-500 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Processing Time
              </p>
              <p className="font-semibold text-slate-900 mt-1">
                {service.processing_time || 'Same day'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <p className="text-slate-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Office &amp; Hours
              </p>
              <p className="font-semibold text-slate-900 mt-1">
                {service.office || 'Barangay Hall'}
              </p>
              {service.office_hours && (
                <p className="text-[11px] text-slate-500">{service.office_hours}</p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <p className="text-slate-500 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Contact
              </p>
              <p className="font-semibold text-slate-900 mt-1">
                {service.contact_number || service.contact_email || 'Barangay Secretariat'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">Documentary Requirements</h2>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2.5 text-xs text-slate-700">
              {service.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-teal-600 shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">Step-by-Step Procedure</h2>
            </div>
          </CardHeader>
          <CardBody>
            <ol className="space-y-3 text-xs text-slate-700">
              {service.procedure_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-800">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
