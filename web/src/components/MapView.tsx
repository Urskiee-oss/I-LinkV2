'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { MapInnerProps, MapMarkerItem } from './MapInner';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from './Button';

const DynamicMapInner = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500">
      Loading interactive map…
    </div>
  ),
});

export type { MapMarkerItem };

export function MapView(props: MapInnerProps) {
  return <DynamicMapInner {...props} />;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = '260px',
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  height?: string;
}) {
  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6)),
        );
      },
      () => {
        // fallback to default barangay center if denied
        onChange(14.6515, 121.0493);
      },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-600 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-blue-700" />
          Click anywhere on the map to pin exact coordinates (optional)
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation}>
            <Navigation className="h-3.5 w-3.5" />
            Use my GPS
          </Button>
          {latitude !== null && longitude !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null, null)}
            >
              Clear pin
            </Button>
          )}
        </div>
      </div>
      <DynamicMapInner
        height={height}
        picked={
          latitude !== null && longitude !== null ? { latitude, longitude } : null
        }
        onPick={(lat, lng) => onChange(lat, lng)}
      />
      {latitude !== null && longitude !== null && (
        <p className="text-xs font-mono text-slate-600">
          Pinned: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}
