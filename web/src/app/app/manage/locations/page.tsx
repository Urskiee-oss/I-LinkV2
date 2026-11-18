'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, MapPin, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  LOCATION_CATEGORIES,
  type CommunityLocation,
  type LocationCategory,
} from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LocationPicker } from '@/components/MapView';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function ManageLocationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CommunityLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityLocation | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<LocationCategory>('evacuation_center');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(14.6515);
  const [longitude, setLongitude] = useState<number | null>(121.0493);
  const [isAccessible, setIsAccessible] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<CommunityLocation[]>('/locations');
      setItems(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategory('evacuation_center');
    setDescription('');
    setAddress('');
    setContactNumber('');
    setCapacity('');
    setLatitude(14.6515);
    setLongitude(121.0493);
    setIsAccessible(true);
    setIsPublic(true);
    setModalOpen(true);
  };

  const openEdit = (loc: CommunityLocation) => {
    setEditing(loc);
    setName(loc.name);
    setCategory(loc.category);
    setDescription(loc.description || '');
    setAddress(loc.address || '');
    setContactNumber(loc.contact_number || '');
    setCapacity(loc.capacity !== null ? String(loc.capacity) : '');
    setLatitude(loc.latitude);
    setLongitude(loc.longitude);
    setIsAccessible(loc.is_accessible);
    setIsPublic(loc.is_public);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === null || longitude === null) {
      toast({ title: 'Please pin coordinates on the map', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        latitude,
        longitude,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        isAccessible,
        isPublic,
      };
      if (editing) {
        await api(`/locations/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Map location updated', variant: 'success' });
      } else {
        await api('/locations', { method: 'POST', body: payload });
        toast({ title: 'Map location created', variant: 'success' });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/locations/${id}`, { method: 'DELETE' });
      toast({ title: 'Location removed', variant: 'info' });
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: errorMessage(err), variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage GIS Map Locations</h1>
            <p className="text-xs text-slate-600">
              Maintain evacuation centers, clinics, flood-prone zones, and public facilities
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Map Pin
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No locations configured" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((loc) => (
            <Card key={loc.id}>
              <CardBody className="flex items-start justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{humanize(loc.category)}</Badge>
                    {loc.is_accessible && <Badge tone="teal">PWD Accessible</Badge>}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 pt-1">{loc.name}</h2>
                  {loc.address && <p className="text-slate-600">{loc.address}</p>}
                  <p className="font-mono text-[11px] text-slate-400">
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(loc)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit GIS Location' : 'Add GIS Location'}
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Facility Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LocationCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {LOCATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Capacity (pax)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAccessible}
                onChange={(e) => setIsAccessible(e.target.checked)}
              />
              PWD Accessible
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Visible to all residents
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Pin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
