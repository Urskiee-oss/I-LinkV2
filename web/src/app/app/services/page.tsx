'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Clock, Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import type { BarangayService } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';

export default function BarangayServicesPage() {
  const [services, setServices] = useState<BarangayService[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setError(null);
    try {
      const res = await api<BarangayService[]>('/services', {
        query: q ? { search: q } : undefined,
      });
      setServices(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              I-Link Barangay Services Directory
            </h1>
            <p className="text-xs text-slate-600">
              Official requirements, fees, processing times, and step-by-step procedures
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(search);
          }}
          className="flex items-center gap-2 w-full sm:w-80"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                load(e.target.value);
              }}
              placeholder="Search clearances, permits, certificates…"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900"
            />
          </div>
        </form>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search)} />
      ) : services.length === 0 ? (
        <EmptyState title="No matching barangay services found" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {services.map((s) => (
            <Link key={s.id} href={`/app/services/${s.id}`} className="block">
              <Card className="h-full hover:border-blue-300 transition-colors">
                <CardBody className="space-y-3 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="blue">{humanize(s.category)}</Badge>
                      {s.fee && (
                        <span className="text-xs font-semibold text-emerald-700">{s.fee}</span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-2">{s.name}</h2>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{s.description}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {s.processing_time || 'Same day'}
                    </span>
                    <span className="font-semibold text-blue-700">
                      View {s.requirements.length} requirements →
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
