'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Edit2, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import type { BarangayService } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function ManageServicesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<BarangayService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BarangayService | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('clearance');
  const [description, setDescription] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [fee, setFee] = useState('');
  const [processingTime, setProcessingTime] = useState('');
  const [office, setOffice] = useState('Barangay Hall Secretariat');
  const [officeHours, setOfficeHours] = useState('Mon–Fri 8:00 AM – 5:00 PM');
  const [contactNumber, setContactNumber] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<BarangayService[]>('/services/manage');
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
    setCategory('clearance');
    setDescription('');
    setRequirementsText('Valid Government ID\nCedula / Community Tax Certificate');
    setStepsText('Present requirements at Window 1\nPay applicable fee\nClaim signed document');
    setFee('Free / ₱50');
    setProcessingTime('15–30 minutes');
    setOffice('Barangay Hall Secretariat');
    setOfficeHours('Mon–Fri 8:00 AM – 5:00 PM');
    setContactNumber('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (s: BarangayService) => {
    setEditing(s);
    setName(s.name);
    setCategory(s.category);
    setDescription(s.description);
    setRequirementsText(s.requirements.join('\n'));
    setStepsText(s.procedure_steps.join('\n'));
    setFee(s.fee || '');
    setProcessingTime(s.processing_time || '');
    setOffice(s.office || '');
    setOfficeHours(s.office_hours || '');
    setContactNumber(s.contact_number || '');
    setIsActive(s.is_active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        requirements: requirementsText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        procedureSteps: stepsText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        fee: fee.trim() || undefined,
        processingTime: processingTime.trim() || undefined,
        office: office.trim() || undefined,
        officeHours: officeHours.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        isActive,
      };
      if (editing) {
        await api(`/services/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Service updated', variant: 'success' });
      } else {
        await api('/services', { method: 'POST', body: payload });
        toast({ title: 'Service created', variant: 'success' });
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
      await api(`/services/${id}`, { method: 'DELETE' });
      toast({ title: 'Service deleted', variant: 'info' });
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
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage Barangay Services</h1>
            <p className="text-xs text-slate-600">
              Update official clearances, certificates, requirements, and steps (also indexed by
              I-Link AI)
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No barangay services configured" />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{humanize(s.category)}</Badge>
                    <Badge tone={s.is_active ? 'emerald' : 'slate'}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {s.fee && <span className="text-xs font-semibold text-slate-700">{s.fee}</span>}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 pt-1">{s.name}</h2>
                  <p className="text-xs text-slate-600">{s.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
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
        title={editing ? 'Edit Barangay Service' : 'New Barangay Service'}
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Service Name *</label>
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
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description *</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Requirements (one per line) *
              </label>
              <textarea
                rows={4}
                required
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Procedure Steps (one per line) *
              </label>
              <textarea
                rows={4}
                required
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fee</label>
              <input
                type="text"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Processing Time</label>
              <input
                type="text"
                value={processingTime}
                onChange={(e) => setProcessingTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office</label>
              <input
                type="text"
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active in directory
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Service
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
