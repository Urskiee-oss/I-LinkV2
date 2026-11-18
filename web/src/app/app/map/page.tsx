'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TIER_COLORS, humanize } from '@/lib/format';
import type {
  CommunityLocation,
  FloodSensor,
  MapEmergency,
  MapReport,
} from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { MapView, type MapMarkerItem } from '@/components/MapView';
import { Skeleton } from '@/components/Skeleton';

export default function CommunityGisMapPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('admin', 'responder');

  const [locations, setLocations] = useState<CommunityLocation[]>([]);
  const [reports, setReports] = useState<MapReport[]>([]);
  const [emergencies, setEmergencies] = useState<MapEmergency[]>([]);
  const [sensors, setSensors] = useState<FloodSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFacilities, setShowFacilities] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showEmergencies, setShowEmergencies] = useState(true);
  const [showSensors, setShowSensors] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [locRes, repRes, senRes, emRes] = await Promise.all([
        api<CommunityLocation[]>('/locations'),
        api<MapReport[]>('/reports/public-map'),
        api<FloodSensor[]>('/flood/sensors'),
        isStaff ? api<MapEmergency[]>('/emergency/map') : Promise.resolve([]),
      ]);
      setLocations(locRes);
      setReports(repRes);
      setSensors(senRes);
      setEmergencies(emRes);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    load();
  }, [load]);

  const markers = useMemo<MapMarkerItem[]>(() => {
    const list: MapMarkerItem[] = [];
    if (showFacilities) {
      for (const loc of locations) {
        const color =
          loc.category === 'evacuation_center'
            ? '#16A34A'
            : loc.category === 'flood_prone_area'
              ? '#D97706'
              : '#1E40AF';
        list.push({
          id: `loc-${loc.id}`,
          latitude: loc.latitude,
          longitude: loc.longitude,
          color,
          badge: humanize(loc.category),
          title: loc.name,
          subtitle: loc.address || loc.description || undefined,
        });
      }
    }
    if (showSensors) {
      for (const s of sensors) {
        list.push({
          id: `sen-${s.id}`,
          latitude: s.latitude,
          longitude: s.longitude,
          color: TIER_COLORS[s.current_tier] || '#0F766E',
          badge: `Flood Sensor · ${humanize(s.current_tier)}`,
          title: s.name,
          subtitle: `Depth: ${s.last_depth_cm ?? 0} cm · ${s.location_text}`,
          href: '/app/flood',
          pulse: s.current_tier !== 'normal',
        });
      }
    }
    if (showReports) {
      for (const r of reports) {
        list.push({
          id: `rep-${r.id}`,
          latitude: r.latitude,
          longitude: r.longitude,
          color: r.module === 'clean' ? '#0F766E' : '#6366F1',
          badge: `${humanize(r.module)} · ${humanize(r.status)}`,
          title: r.title,
          subtitle: `${r.reference_code} · ${humanize(r.category)}`,
          href: isStaff ? `/app/reports/${r.id}` : undefined,
        });
      }
    }
    if (isStaff && showEmergencies) {
      for (const em of emergencies) {
        list.push({
          id: `em-${em.id}`,
          latitude: em.latitude,
          longitude: em.longitude,
          color: '#DC2626',
          badge: `Emergency · ${humanize(em.category)}`,
          title: em.title,
          subtitle: `${em.reference_code} · ${humanize(em.status)}`,
          href: `/app/emergency/${em.id}`,
          pulse: em.status !== 'resolved',
        });
      }
    }
    return list;
  }, [
    locations,
    sensors,
    reports,
    emergencies,
    showFacilities,
    showSensors,
    showReports,
    showEmergencies,
    isStaff,
  ]);

  if (loading) {
    return <Skeleton className="h-[540px] w-full" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">I-Link Community GIS Map</h1>
          <p className="text-xs text-slate-600">
            Interactive OpenStreetMap view of barangay facilities, evacuation centers, flood
            sensors, and geo-pinned reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showFacilities}
              onChange={(e) => setShowFacilities(e.target.checked)}
            />
            <span className="h-2.5 w-2.5 rounded-full bg-[#1E40AF]" />
            Facilities ({locations.length})
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showSensors}
              onChange={(e) => setShowSensors(e.target.checked)}
            />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Flood Sensors ({sensors.length})
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showReports}
              onChange={(e) => setShowReports(e.target.checked)}
            />
            <span className="h-2.5 w-2.5 rounded-full bg-[#0F766E]" />
            Public Reports ({reports.length})
          </label>
          {isStaff && (
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmergencies}
                onChange={(e) => setShowEmergencies(e.target.checked)}
              />
              <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
              Staff Emergency Pins ({emergencies.length})
            </label>
          )}
        </div>
      </div>

      <MapView height="500px" markers={markers} />

      {/* Directory of Facilities */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Barangay Facilities &amp; Evacuation Centers
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="rounded-xl border border-slate-200 p-3.5 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    tone={
                      loc.category === 'evacuation_center'
                        ? 'emerald'
                        : loc.category === 'flood_prone_area'
                          ? 'amber'
                          : 'blue'
                    }
                  >
                    {humanize(loc.category)}
                  </Badge>
                  {loc.is_accessible && <Badge tone="teal">PWD Accessible</Badge>}
                </div>
                <p className="font-semibold text-slate-900 text-sm">{loc.name}</p>
                {loc.address && <p className="text-slate-600">{loc.address}</p>}
                {loc.description && <p className="text-slate-500">{loc.description}</p>}
                <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-500">
                  {loc.contact_number && <span>Tel: {loc.contact_number}</span>}
                  {loc.capacity && <span>Capacity: {loc.capacity} pax</span>}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
