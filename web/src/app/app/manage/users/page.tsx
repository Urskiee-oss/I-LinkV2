'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { humanize } from '@/lib/format';
import type { AppRole, UserWithRoles } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function ManageUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<UserWithRoles[]>('/users', {
        query: {
          search: search.trim() || undefined,
          role: roleFilter || undefined,
        },
      });
      setUsers(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (userId: string, role: AppRole) => {
    try {
      await api(`/users/${userId}/role`, {
        method: 'PUT',
        body: { role },
      });
      toast({ title: `Role updated to ${humanize(role)}`, variant: 'success' });
      await load();
    } catch (err) {
      toast({ title: 'Role update failed', description: errorMessage(err), variant: 'error' });
    }
  };

  const toggleActive = async (u: UserWithRoles) => {
    try {
      await api(`/users/${u.id}`, {
        method: 'PATCH',
        body: { isActive: !u.is_active },
      });
      toast({
        title: u.is_active ? 'Account deactivated' : 'Account activated',
        variant: 'info',
      });
      await load();
    } catch (err) {
      toast({ title: 'Update failed', description: errorMessage(err), variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Manage Barangay Users &amp; Roles
            </h1>
            <p className="text-xs text-slate-600">
              Assign Resident, Responder, or Admin permissions and manage active status
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="">All Roles</option>
            <option value="resident">Resident</option>
            <option value="responder">Responder</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState title="No matching users found" />
      ) : (
        <div className="space-y-2.5">
          {users.map((u) => {
            const currentRole: AppRole = u.roles.includes('admin')
              ? 'admin'
              : u.roles.includes('responder')
                ? 'responder'
                : 'resident';

            return (
              <Card key={u.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{u.full_name}</span>
                      <Badge tone={u.is_active ? 'emerald' : 'red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      {u.email}
                      {u.purok ? ` · ${u.purok}` : ''}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={currentRole}
                      onChange={(e) => changeRole(u.id, e.target.value as AppRole)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                    >
                      <option value="resident">Resident</option>
                      <option value="responder">Responder</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
