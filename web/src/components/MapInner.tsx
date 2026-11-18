'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href?: string;
  pulse?: boolean;
}

function makePinIcon(color: string, pulse = false) {
  const pulseRing = pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:0.28;"></span>`
    : '';
  return L.divIcon({
    className: 'ilink-pin-icon',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<div style="position:relative;width:28px;height:36px;display:flex;align-items:center;justify-content:center;">
      ${pulseRing}
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 1C6.82 1 1 6.82 1 14C1 23.25 14 35 14 35C14 35 27 23.25 27 14C27 6.82 21.18 1 14 1Z" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="#FFFFFF"/>
      </svg>
    </div>`,
  });
}

function ClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onPick) {
        onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export interface MapInnerProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarkerItem[];
  picked?: { latitude: number; longitude: number } | null;
  onPick?: (lat: number, lng: number) => void;
  height?: string;
}

const DEFAULT_CENTER: [number, number] = [14.6515, 121.0493]; // Quezon City barangay default

export default function MapInner({
  center = DEFAULT_CENTER,
  zoom = 15,
  markers = [],
  picked = null,
  onPick,
  height = '420px',
}: MapInnerProps) {
  const effectiveCenter: [number, number] = picked
    ? [picked.latitude, picked.longitude]
    : center;

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={effectiveCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onPick && <ClickHandler onPick={onPick} />}
        {picked && <Recenter lat={picked.latitude} lng={picked.longitude} />}
        {picked && (
          <Marker
            position={[picked.latitude, picked.longitude]}
            icon={makePinIcon('#1E40AF', true)}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold text-slate-900">Selected coordinates</p>
                <p className="text-slate-600 font-mono">
                  {picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.latitude, m.longitude]}
            icon={makePinIcon(m.color, m.pulse)}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[160px]">
                {m.badge && (
                  <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {m.badge}
                  </span>
                )}
                <p className="font-semibold text-slate-900">{m.title}</p>
                {m.subtitle && <p className="text-slate-600">{m.subtitle}</p>}
                {m.href && (
                  <a
                    href={m.href}
                    className="inline-block pt-1 font-medium text-blue-700 hover:underline"
                  >
                    View details →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
