'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import type { Announcement, AnnouncementPriority } from '@/lib/types';
import { Badge, PriorityBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Modal } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function ManageAnnouncementsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('advisory');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<Announcement[]>('/announcements/manage');
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
    setTitle('');
    setSummary('');
    setBody('');
    setCategory('advisory');
    setPriority('normal');
    setIsPinned(false);
    setIsPublished(true);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title);
    setSummary(a.summary || '');
    setBody(a.body);
    setCategory(a.category);
    setPriority(a.priority);
    setIsPinned(a.is_pinned);
    setIsPublished(a.is_published);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim() || undefined,
        body: body.trim(),
        category,
        priority,
        isPinned,
        isPublished,
      };
      if (editing) {
        await api(`/announcements/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Announcement updated', variant: 'success' });
      } else {
        await api('/announcements', { method: 'POST', body: payload });
        toast({ title: 'Announcement published', variant: 'success' });
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
      await api(`/announcements/${id}`, { method: 'DELETE' });
      toast({ title: 'Announcement deleted', variant: 'info' });
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
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage I-Link Access Announcements</h1>
            <p className="text-xs text-slate-600">
              Publish official advisories and broadcast instant alerts to residents
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No announcements created yet" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.is_pinned && (
                      <Badge tone="blue">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </Badge>
                    )}
                    <PriorityBadge priority={a.priority} />
                    <Badge tone={a.is_published ? 'emerald' : 'slate'}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge tone="slate">{humanize(a.category)}</Badge>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">{a.title}</h2>
                  <p className="text-xs text-slate-600 line-clamp-2">{a.summary || a.body}</p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(a.published_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
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
        title={editing ? 'Edit Announcement' : 'Create Announcement'}
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Short Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Body *</label>
            <textarea
              rows={5}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              Pin to top of feed
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              Publish immediately
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save Changes' : 'Publish Announcement'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
