'use client';

import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { humanize } from '@/lib/format';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { useToast } from '@/components/Toast';

export default function ProfilePage() {
  const { me, refreshMe } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [purok, setPurok] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) {
      setFullName(me.profile.full_name || '');
      setPhone(me.profile.phone || '');
      setPurok(me.profile.purok || '');
      setAddress(me.profile.address || '');
    }
  }, [me]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/users/me', {
        method: 'PATCH',
        body: {
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          purok: purok.trim() || undefined,
          address: address.trim() || undefined,
        },
      });
      await refreshMe();
      toast({ title: 'Profile updated', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not update profile',
        description: errorMessage(err),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!me) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">My Barangay Profile</h1>
              <p className="text-xs text-slate-500">{me.email}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {me.roles.map((r) => (
              <Badge key={r} tone="blue">
                {humanize(r)}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917 123 4567"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purok / Zone
                </label>
                <input
                  type="text"
                  value={purok}
                  onChange={(e) => setPurok(e.target.value)}
                  placeholder="Purok 1 - Mabuhay"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Complete Household Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House No., Street Name, Barangay"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>
                Save Profile Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
