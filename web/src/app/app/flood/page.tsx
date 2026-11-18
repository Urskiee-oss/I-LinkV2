'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Copy, KeyRound, Plus, TrendingUp, Waves } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRealtimeEvent } from '@/lib/realtime';
import {
  TIER_COLORS,
  formatDateTime,
  formatNumber,
  formatTime,
  humanize,
  timeAgo,
} from '@/lib/format';
import type { FloodAlert, FloodSensor, SensorReading } from '@/lib/types';
import { Badge, FloodTierBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LocationPicker } from '@/components/MapView';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function FloodEarlyWarningPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { toast } = useToast();

  const [sensors, setSensors] = useState<FloodSensor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin register sensor modal
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(14.6515);
  const [longitude, setLongitude] = useState<number | null>(121.0493);
  const [sensorHeightCm, setSensorHeightCm] = useState(300);
  const [advisoryCm, setAdvisoryCm] = useState(80);
  const [warningCm, setWarningCm] = useState(130);
  const [dangerCm, setDangerCm] = useState(180);
  const [criticalCm, setCriticalCm] = useState(220);
  const [rapidRiseCmMin, setRapidRiseCmMin] = useState(2.5);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const loadSensorsAndAlerts = useCallback(async () => {
    setError(null);
    try {
      const [senRes, alRes] = await Promise.all([
        api<FloodSensor[]>('/flood/sensors'),
        api<FloodAlert[]>('/flood/alerts', { query: { limit: 25 } }),
      ]);
      setSensors(senRes);
      setAlerts(alRes);
      if (senRes.length > 0 && !selectedId) {
        setSelectedId(senRes[0].id);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadReadings = useCallback(async (sensorId: string) => {
    try {
      const res = await api<SensorReading[]>(`/flood/sensors/${sensorId}/readings`, {
        query: { limit: 60 },
      });
      setReadings(res);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSensorsAndAlerts();
  }, [loadSensorsAndAlerts]);

  useEffect(() => {
    if (selectedId) {
      loadReadings(selectedId);
    }
  }, [selectedId, loadReadings]);

  useRealtimeEvent('flood:reading', ({ sensor, reading }) => {
    setSensors((prev) => prev.map((s) => (s.id === sensor.id ? sensor : s)));
    if (sensor.id === selectedId) {
      setReadings((prev) => [reading, ...prev.slice(0, 59)]);
    }
  });

  useRealtimeEvent('flood:alert', (alert) => {
    setAlerts((prev) => [alert, ...prev]);
    loadSensorsAndAlerts();
  });

  const handleCreateSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === null || longitude === null) {
      toast({ title: 'Please pin sensor coordinates on the map', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ sensor: FloodSensor; device_key: string }>('/flood/sensors', {
        method: 'POST',
        body: {
          name: name.trim(),
          locationText: locationText.trim(),
          latitude,
          longitude,
          sensorHeightCm: Number(sensorHeightCm),
          advisoryCm: Number(advisoryCm),
          warningCm: Number(warningCm),
          dangerCm: Number(dangerCm),
          criticalCm: Number(criticalCm),
          rapidRiseCmMin: Number(rapidRiseCmMin),
        },
      });
      setCreatedKey(res.device_key);
      await loadSensorsAndAlerts();
      setSelectedId(res.sensor.id);
      toast({
        title: 'IoT Flood Sensor registered',
        description: 'Copy the one-time device key now.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Failed to register sensor',
        description: errorMessage(err),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSensorsAndAlerts} />;
  }

  const selectedSensor = sensors.find((s) => s.id === selectedId) ?? sensors[0] ?? null;
  const chartData = [...readings]
    .reverse()
    .map((r) => ({
      time: formatTime(r.recorded_at),
      depth_cm: r.depth_cm,
      rise_cm_min: r.rise_cm_min ?? 0,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              IoT Flood Early Warning &amp; Water-Level Telemetry
            </h1>
            <p className="text-xs text-slate-600">
              PAGASA / NDRRMC 4-tier water depth &amp; rapid rise velocity monitoring
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setCreatedKey(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Register IoT Sensor
          </Button>
        )}
      </div>

      {/* PAGASA / NDRRMC 4-Tier Reference Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
        {(
          [
            { tier: 'normal', label: 'Normal', desc: 'Safe waterway level' },
            { tier: 'advisory', label: 'Advisory (Yellow)', desc: 'Monitor creek level' },
            { tier: 'warning', label: 'Warning (Orange)', desc: 'Prepare for evacuation' },
            { tier: 'danger', label: 'Danger (Red)', desc: 'Pre-emptive evacuation' },
            { tier: 'critical', label: 'Critical (Dark Red)', desc: 'Forced evacuation now' },
          ] as const
        ).map((item) => (
          <div
            key={item.tier}
            className="rounded-xl border border-slate-200 bg-white p-3 flex items-start gap-2.5"
          >
            <span
              className="mt-1 h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: TIER_COLORS[item.tier] }}
            />
            <div>
              <p className="font-semibold text-slate-900">{item.label}</p>
              <p className="text-[11px] text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sensor Cards */}
      {sensors.length === 0 ? (
        <EmptyState title="No IoT flood sensors registered" />
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {sensors.map((s) => {
            const active = s.id === selectedSensor?.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all bg-white ${
                  active
                    ? 'border-[#1E40AF] ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <FloodTierBadge tier={s.current_tier} />
                  <span className="text-[11px] text-slate-400">
                    {s.last_reading_at ? timeAgo(s.last_reading_at) : 'No readings'}
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-bold text-slate-900">{s.name}</h2>
                <p className="text-xs text-slate-500 truncate">{s.location_text}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Water Depth
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatNumber(s.last_depth_cm, 1)} cm
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Rise Velocity
                    </p>
                    <p className="text-lg font-bold text-slate-900 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-teal-700" />
                      {formatNumber(s.last_rise_cm_min, 2)} cm/m
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap justify-between text-[10px] text-slate-500">
                  <span>Adv: {s.advisory_cm}cm</span>
                  <span>Warn: {s.warning_cm}cm</span>
                  <span>Dng: {s.danger_cm}cm</span>
                  <span>Crit: {s.critical_cm}cm</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Sensor Telemetry Chart */}
      {selectedSensor && (
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Water Depth Telemetry: {selectedSensor.name}
              </h2>
              <p className="text-xs text-slate-500">
                Thresholds — Advisory {selectedSensor.advisory_cm}cm · Warning{' '}
                {selectedSensor.warning_cm}cm · Danger {selectedSensor.danger_cm}cm · Critical{' '}
                {selectedSensor.critical_cm}cm (Rapid rise escalation ≥{' '}
                {selectedSensor.rapid_rise_cm_min} cm/min)
              </p>
            </div>
            <FloodTierBadge tier={selectedSensor.current_tier} />
          </CardHeader>
          <CardBody>
            {chartData.length === 0 ? (
              <EmptyState title="No readings recorded for this sensor yet" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis unit=" cm" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine
                      y={selectedSensor.advisory_cm}
                      stroke="#EAB308"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={selectedSensor.warning_cm}
                      stroke="#F97316"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={selectedSensor.danger_cm}
                      stroke="#DC2626"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="depth_cm"
                      name="Water Depth (cm)"
                      stroke="#0F766E"
                      fill="#99F6E4"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Alert History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Flood Alert Escalation Log</h2>
          </div>
        </CardHeader>
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState title="No flood alert escalations recorded" />
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FloodTierBadge tier={a.tier} />
                      <span className="text-slate-400">from {humanize(a.previous_tier)}</span>
                      {a.sensor && (
                        <Badge tone="slate">{a.sensor.name}</Badge>
                      )}
                    </div>
                    <p className="font-medium text-slate-900">{a.message}</p>
                  </div>
                  <div className="text-right text-slate-500">
                    <p className="font-mono font-semibold text-slate-800">
                      {a.depth_cm} cm
                      {a.rise_cm_min !== null ? ` (${a.rise_cm_min} cm/min)` : ''}
                    </p>
                    <p className="text-[11px]">{formatDateTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Admin Register Sensor Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register Ultrasonic IoT Flood Sensor"
        maxWidth="xl"
      >
        {createdKey ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <KeyRound className="h-4 w-4 text-emerald-700" />
                One-Time Device API Key (Save this now!)
              </div>
              <p className="text-emerald-800">
                Pass this key in the <code className="font-mono">x-device-key</code> HTTP header
                when posting ultrasonic telemetry to <code className="font-mono">POST /api/iot/readings</code>.
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-emerald-200 p-2.5 font-mono text-xs text-slate-900">
                <span className="break-all">{createdKey}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(createdKey);
                    toast({ title: 'Device key copied to clipboard', variant: 'success' });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setModalOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSensor} className="space-y-3.5 text-xs">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sensor Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Creek Bridge Station B"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Waterway / Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g. Purok 3 Riverside Footbridge"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={sensorHeightCm}
                  onChange={(e) => setSensorHeightCm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Advisory</label>
                <input
                  type="number"
                  value={advisoryCm}
                  onChange={(e) => setAdvisoryCm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warning</label>
                <input
                  type="number"
                  value={warningCm}
                  onChange={(e) => setWarningCm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Danger</label>
                <input
                  type="number"
                  value={dangerCm}
                  onChange={(e) => setDangerCm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Critical</label>
                <input
                  type="number"
                  value={criticalCm}
                  onChange={(e) => setCriticalCm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rise cm/m</label>
                <input
                  type="number"
                  step="0.1"
                  value={rapidRiseCmMin}
                  onChange={(e) => setRapidRiseCmMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
            </div>

            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              height="200px"
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create Sensor &amp; Generate Key
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
