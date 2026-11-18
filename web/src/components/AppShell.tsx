'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  AlertTriangle,
  Bell,
  Bot,
  Building2,
  CheckCheck,
  FileText,
  Flame,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  PhoneCall,
  ShieldAlert,
  User,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime';
import { api } from '@/lib/api';
import { humanize, timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { Badge } from './Badge';
import { Button } from './Button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, logout, hasRole } = useAuth();
  const { connected } = useRealtime();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isStaff = hasRole('admin', 'responder');
  const isAdmin = hasRole('admin');

  const loadNotifications = useCallback(async () => {
    if (!me) return;
    try {
      const [list, countRes] = await Promise.all([
        api<AppNotification[]>('/notifications'),
        api<{ count: number }>('/notifications/unread-count'),
      ]);
      setNotifications(list);
      setUnreadCount(countRes.count);
    } catch {
      // ignore
    }
  }, [me]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useRealtimeEvent('notification:new', (n) => {
    setNotifications((prev) => [n, ...prev.slice(0, 49)]);
    setUnreadCount((c) => c + 1);
  });

  const markRead = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await api(`/notifications/${n.id}/read`, { method: 'PATCH' });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setNotifOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const mainNav: NavItem[] = [
    ...(isStaff
      ? [{ href: '/app/dashboard', label: 'Intelligence Dashboard', icon: LayoutDashboard }]
      : []),
    { href: '/app/home', label: 'Resident Home', icon: Home },
    { href: '/app/ai', label: 'I-Link AI Assistant', icon: Bot },
    { href: '/app/emergency/new', label: 'Report Emergency', icon: Flame },
    { href: '/app/reports/new', label: 'Submit Report', icon: FileText },
    { href: '/app/clean', label: 'I-Link Clean', icon: Leaf },
    { href: '/app/my-reports', label: 'My Reports', icon: ShieldAlert },
    { href: '/app/map', label: 'Community GIS Map', icon: MapPin },
    { href: '/app/flood', label: 'Flood Early Warning', icon: Waves },
    { href: '/app/announcements', label: 'I-Link Access News', icon: Megaphone },
    { href: '/app/bayanihan', label: 'I-Link Bayanihan', icon: HeartHandshake },
    { href: '/app/services', label: 'Barangay Services', icon: Building2 },
    { href: '/app/profile', label: 'My Profile', icon: User },
  ];

  const staffNav: NavItem[] = [];
  if (isStaff) {
    staffNav.push(
      { href: '/app/manage/emergency', label: 'Emergency Queue', icon: AlertTriangle },
      { href: '/app/manage/reports', label: 'Reports Queue', icon: FileText },
    );
  }
  if (isAdmin) {
    staffNav.push(
      { href: '/app/manage/announcements', label: 'Manage Announcements', icon: Megaphone },
      { href: '/app/manage/locations', label: 'Manage Map Pins', icon: MapPin },
      { href: '/app/manage/services', label: 'Manage Services', icon: Building2 },
      { href: '/app/manage/bayanihan', label: 'Manage Bayanihan', icon: HeartHandshake },
      { href: '/app/manage/users', label: 'Manage Users', icon: Users },
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
        Loading I-Link…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h1 className="text-lg font-bold text-slate-900">Sign in to access I-Link</h1>
          <p className="text-xs text-slate-600">
            Your session has ended or you have not signed in yet.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/login">
              <Button>Go to Sign In</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to Landing</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Persistent Emergency Hotline Strip */}
      <div className="bg-[#DC2626] text-white px-4 py-1.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 z-40">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-3.5 w-3.5 shrink-0" />
          <span>In immediate danger? Call 911 · BFP 160 · PNP 117</span>
        </div>
        <Link
          href="/app/emergency/new"
          className="underline font-semibold hover:text-red-100"
        >
          Dispatch Barangay Responder →
        </Link>
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/app" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E40AF] text-white font-bold text-sm">
              IL
            </span>
            <div className="leading-tight">
              <span className="font-bold text-sm text-slate-900 tracking-tight block">
                I-Link Barangay
              </span>
              <span className="text-[10px] text-slate-500 block">
                Community Intelligence &amp; Resilience
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Socket.IO Indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
            title={connected ? 'Connected to live barangay feed' : 'Realtime feed offline'}
          >
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
              )}
            />
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-900">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-500">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markRead(n)}
                        className={clsx(
                          'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5',
                          !n.is_read && 'bg-blue-50/40',
                        )}
                      >
                        <span
                          className={clsx(
                            'mt-1.5 h-2 w-2 rounded-full shrink-0',
                            !n.is_read ? 'bg-blue-600' : 'bg-transparent',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {n.title}
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{n.body}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden md:block text-right">
              <p className="text-xs font-semibold text-slate-900 leading-tight">
                {me.profile.full_name}
              </p>
              <Badge
                tone={
                  me.primary_role === 'admin'
                    ? 'blue'
                    : me.primary_role === 'responder'
                      ? 'teal'
                      : 'slate'
                }
                className="text-[10px] py-0 px-1.5"
              >
                {humanize(me.primary_role)}
              </Badge>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-slate-200 pt-24 lg:pt-4 pb-6 px-3 flex flex-col justify-between transition-transform lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav className="space-y-5 overflow-y-auto">
            <div>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Community Modules
              </p>
              <ul className="space-y-0.5">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/app/home' &&
                      item.href !== '/app/dashboard' &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={clsx(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                          active
                            ? 'bg-blue-50 text-[#1E40AF] font-semibold'
                            : 'text-slate-700 hover:bg-slate-100',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {staffNav.length > 0 && (
              <div>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Operations &amp; Admin
                </p>
                <ul className="space-y-0.5">
                  {staffNav.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={clsx(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                            active
                              ? 'bg-teal-50 text-[#0F766E] font-semibold'
                              : 'text-slate-700 hover:bg-slate-100',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </nav>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
            <p className="font-semibold text-slate-800">Signed in as</p>
            <p className="text-slate-600 truncate">{me.email}</p>
            {me.profile.purok && (
              <p className="text-[11px] text-slate-500 mt-0.5">{me.profile.purok}</p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
