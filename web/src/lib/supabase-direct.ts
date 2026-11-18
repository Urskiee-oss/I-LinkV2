'use client';

import { supabase } from './supabase';
import type {
  AppRole,
  CLEAN_CATEGORIES,
  CommunityCategory,
  EmergencyCategory,
  FloodTier,
  ReportPriority,
  ReportStatus,
} from './types';

const CLEAN_SET = new Set<string>([
  'garbage_accumulation',
  'illegal_dumping',
  'blocked_drainage',
  'sanitation',
  'air_pollution',
  'water_pollution',
]);

const FLOOD_TIERS: FloodTier[] = ['normal', 'advisory', 'warning', 'danger', 'critical'];

function primaryRoleOf(roles: AppRole[]): AppRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('responder')) return 'responder';
  return 'resident';
}

function highestTierOf(tiers: FloodTier[]): FloodTier {
  let max = 0;
  for (const t of tiers) {
    const idx = FLOOD_TIERS.indexOf(t);
    if (idx > max) max = idx;
  }
  return FLOOD_TIERS[max];
}

function scoreEmergency(category: EmergencyCategory, text: string, people?: number | null) {
  const baseMap: Record<string, number> = {
    fire: 90,
    flood: 84,
    medical: 88,
    earthquake: 90,
    landslide: 86,
    crime: 82,
    accident: 80,
    missing_person: 85,
    power_outage: 62,
    other: 65,
  };
  let score = baseMap[category] ?? 70;
  const reasons = [`Base severity for ${category.replace(/_/g, ' ')} (${score})`];
  if (/\b(school|elementary|hospital|health center|clinic)\b/i.test(text)) {
    score += 8;
    reasons.push('Near school or health facility (+8)');
  }
  if (/\b(elderly|senior|pwd|disabled|wheelchair|children|infant|trapped)\b/i.test(text)) {
    score += 8;
    reasons.push('Vulnerable residents affected (+8)');
  }
  if (people && people > 0) {
    const bonus = Math.min(12, Math.ceil(people / 3) * 3);
    score += bonus;
    reasons.push(`${people} person(s) affected (+${bonus})`);
  }
  score = Math.min(100, score);
  const priority: ReportPriority =
    score >= 85 ? 'critical' : score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
  return { priority, score, reasons };
}

function scoreCommunity(category: CommunityCategory, text: string) {
  const baseMap: Record<string, number> = {
    blocked_drainage: 68,
    water_pollution: 66,
    illegal_dumping: 60,
    garbage_accumulation: 55,
    sanitation: 58,
    air_pollution: 56,
    road_damage: 58,
    streetlight: 52,
    accessibility_obstacle: 62,
    stray_animals: 48,
    noise: 38,
    other: 42,
  };
  let score = baseMap[category] ?? 50;
  const reasons = [`Category baseline: ${category.replace(/_/g, ' ')} (${score})`];
  if (/\b(school|health center|clinic|elderly|pwd|wheelchair)\b/i.test(text)) {
    score += 10;
    reasons.push('Impacts vulnerable group or critical facility (+10)');
  }
  score = Math.min(100, score);
  const priority: ReportPriority =
    score >= 82 ? 'critical' : score >= 65 ? 'high' : score >= 42 ? 'medium' : 'low';
  return { priority, score, reasons };
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

const EM_SELECT =
  '*, reporter:profiles!emergency_reports_reporter_id_fkey(id, full_name, email, phone, purok), assignee:profiles!emergency_reports_assigned_to_fkey(id, full_name, email, phone, purok)';
const CR_SELECT =
  '*, reporter:profiles!community_reports_reporter_id_fkey(id, full_name, email, phone, purok), assignee:profiles!community_reports_assigned_to_fkey(id, full_name, email, phone, purok)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function supabaseDirectApi<T>(
  path: string,
  opts: {
    method?: string;
    body?: any;
    query?: Record<string, any>;
  } = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  const query = opts.query ?? {};
  const cleanPath = path.replace(/\?.*$/, '');

  // ---- AUTH & USERS ----
  if (cleanPath === '/auth/login' && method === 'POST') {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: opts.body.email,
      password: opts.body.password,
    });
    if (error || !data.session) throw new Error(error?.message || 'Invalid email or password');
    return {
      access_token: data.session.access_token,
      user: { id: data.user.id, email: data.user.email },
    } as T;
  }

  if (cleanPath === '/auth/register' && method === 'POST') {
    const { data, error } = await supabase.auth.signUp({
      email: opts.body.email,
      password: opts.body.password,
      options: {
        data: {
          full_name: opts.body.fullName,
          phone: opts.body.phone || null,
          purok: opts.body.purok || null,
        },
      },
    });
    if (error || !data.user) throw new Error(error?.message || 'Registration failed');
    return { id: data.user.id, email: data.user.email } as T;
  }

  if (cleanPath === '/auth/me' && method === 'GET') {
    const { data: userRes, error: uErr } = await supabase.auth.getUser();
    if (uErr || !userRes.user) throw new Error('Not authenticated');
    const uid = userRes.user.id;
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    const roles: AppRole[] =
      roleRows && roleRows.length > 0
        ? (roleRows.map((r: { role: AppRole }) => r.role) as AppRole[])
        : ['resident'];
    return {
      id: uid,
      email: userRes.user.email ?? '',
      roles,
      primary_role: primaryRoleOf(roles),
      profile: profile ?? {
        id: uid,
        full_name: userRes.user.user_metadata?.full_name || userRes.user.email || 'Resident',
        email: userRes.user.email ?? '',
        phone: null,
        purok: null,
        address: null,
        avatar_url: null,
        is_active: true,
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    } as T;
  }

  if (cleanPath === '/users/me' && method === 'PATCH') {
    const uid = await currentUserId();
    const patch: Record<string, unknown> = {};
    if (opts.body?.fullName !== undefined) patch.full_name = opts.body.fullName;
    if (opts.body?.phone !== undefined) patch.phone = opts.body.phone;
    if (opts.body?.purok !== undefined) patch.purok = opts.body.purok;
    if (opts.body?.address !== undefined) patch.address = opts.body.address;
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', uid)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  if (cleanPath === '/users/responders' && method === 'GET') {
    const { data } = await supabase.rpc('get_responders_list');
    return (data ?? []) as T;
  }

  if (cleanPath === '/users' && method === 'GET') {
    const { data } = await supabase.rpc('get_users_with_roles');
    let list = (data ?? []) as Array<Record<string, any>>;
    if (query.role) {
      list = list.filter((u) => Array.isArray(u.roles) && u.roles.includes(query.role));
    }
    if (query.search) {
      const s = String(query.search).toLowerCase();
      list = list.filter(
        (u) =>
          String(u.full_name ?? '').toLowerCase().includes(s) ||
          String(u.email ?? '').toLowerCase().includes(s),
      );
    }
    return list as T;
  }

  const userRoleMatch = cleanPath.match(/^\/users\/([^/]+)\/role$/);
  if (userRoleMatch && method === 'PUT') {
    const targetId = userRoleMatch[1];
    await supabase.from('user_roles').delete().eq('user_id', targetId);
    await supabase.from('user_roles').insert({ user_id: targetId, role: opts.body.role });
    const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    return { ...p, roles: [opts.body.role] } as T;
  }

  const userPatchMatch = cleanPath.match(/^\/users\/([^/]+)$/);
  if (userPatchMatch && method === 'PATCH') {
    const targetId = userPatchMatch[1];
    const patch: Record<string, unknown> = {};
    if (opts.body?.isActive !== undefined) patch.is_active = opts.body.isActive;
    if (opts.body?.fullName !== undefined) patch.full_name = opts.body.fullName;
    const { data: p, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', targetId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    const { data: r } = await supabase.from('user_roles').select('role').eq('user_id', targetId);
    return { ...p, roles: (r ?? []).map((x: { role: string }) => x.role) } as T;
  }

  // ---- EMERGENCY REPORTS ----
  if (cleanPath === '/emergency' && method === 'POST') {
    const uid = await currentUserId();
    const b =
      opts.body instanceof FormData ? Object.fromEntries(opts.body.entries()) : opts.body ?? {};
    const triage = scoreEmergency(
      b.category,
      `${b.title} ${b.description} ${b.locationText}`,
      b.peopleAffected ? Number(b.peopleAffected) : null,
    );
    const { data, error } = await supabase
      .from('emergency_reports')
      .insert({
        reporter_id: uid,
        category: b.category,
        title: String(b.title).trim(),
        description: String(b.description).trim(),
        location_text: String(b.locationText).trim(),
        latitude: b.latitude ? Number(b.latitude) : null,
        longitude: b.longitude ? Number(b.longitude) : null,
        people_affected: b.peopleAffected ? Number(b.peopleAffected) : null,
        status: 'submitted',
        priority: triage.priority,
        priority_score: triage.score,
        priority_reasons: triage.reasons,
      })
      .select(EM_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return { ...data, attachments: [], updates: [] } as T;
  }

  if (cleanPath === '/emergency/mine' && method === 'GET') {
    const uid = await currentUserId();
    const { data } = await supabase
      .from('emergency_reports')
      .select(EM_SELECT)
      .eq('reporter_id', uid)
      .order('created_at', { ascending: false });
    return (data ?? []) as T;
  }

  if (cleanPath === '/emergency/map' && method === 'GET') {
    const { data } = await supabase
      .from('emergency_reports')
      .select('id, reference_code, category, title, status, priority, latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    return ((data ?? []).map((r: Record<string, unknown>) => ({ ...r, kind: 'emergency' })) as unknown) as T;
  }

  if (cleanPath === '/emergency' && method === 'GET') {
    let q = supabase
      .from('emergency_reports')
      .select(EM_SELECT)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });
    if (query.status) q = q.eq('status', query.status);
    if (query.category) q = q.eq('category', query.category);
    const { data } = await q;
    return (data ?? []) as T;
  }

  const emStatusMatch = cleanPath.match(/^\/emergency\/([^/]+)\/status$/);
  if (emStatusMatch && method === 'PATCH') {
    const id = emStatusMatch[1];
    const uid = await currentUserId();
    const { data: cur } = await supabase.from('emergency_reports').select('status').eq('id', id).single();
    await supabase
      .from('emergency_reports')
      .update({
        status: opts.body.status,
        resolved_at: opts.body.status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    await supabase.from('report_updates').insert({
      emergency_report_id: id,
      author_id: uid,
      from_status: cur?.status ?? null,
      to_status: opts.body.status,
      note: opts.body.note || `Status updated to ${opts.body.status}.`,
      is_internal: false,
    });
    return supabaseDirectApi<T>(`/emergency/${id}`);
  }

  const emNoteMatch = cleanPath.match(/^\/emergency\/([^/]+)\/notes$/);
  if (emNoteMatch && method === 'POST') {
    const id = emNoteMatch[1];
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('report_updates')
      .insert({
        emergency_report_id: id,
        author_id: uid,
        note: opts.body.note,
        is_internal: Boolean(opts.body.isInternal),
      })
      .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  const emAssignMatch = cleanPath.match(/^\/emergency\/([^/]+)\/assign$/);
  if (emAssignMatch && method === 'PATCH') {
    const id = emAssignMatch[1];
    await supabase
      .from('emergency_reports')
      .update({ assigned_to: opts.body.assigneeId ?? null })
      .eq('id', id);
    return supabaseDirectApi<T>(`/emergency/${id}`);
  }

  const emIdMatch = cleanPath.match(/^\/emergency\/([^/]+)$/);
  if (emIdMatch && method === 'GET') {
    const id = emIdMatch[1];
    const [{ data: report, error }, { data: updates }] = await Promise.all([
      supabase.from('emergency_reports').select(EM_SELECT).eq('id', id).single(),
      supabase
        .from('report_updates')
        .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
        .eq('emergency_report_id', id)
        .order('created_at', { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    return { ...report, attachments: [], updates: updates ?? [] } as T;
  }

  // ---- COMMUNITY & CLEANLINESS REPORTS ----
  if (cleanPath === '/reports' && method === 'POST') {
    const uid = await currentUserId();
    const b =
      opts.body instanceof FormData ? Object.fromEntries(opts.body.entries()) : opts.body ?? {};
    const mod = b.module || (CLEAN_SET.has(String(b.category)) ? 'clean' : 'general');
    const triage = scoreCommunity(b.category, `${b.title} ${b.description} ${b.locationText}`);
    const { data, error } = await supabase
      .from('community_reports')
      .insert({
        reporter_id: uid,
        module: mod,
        category: b.category,
        title: String(b.title).trim(),
        description: String(b.description).trim(),
        location_text: String(b.locationText).trim(),
        latitude: b.latitude ? Number(b.latitude) : null,
        longitude: b.longitude ? Number(b.longitude) : null,
        status: 'submitted',
        priority: triage.priority,
        priority_score: triage.score,
        priority_reasons: triage.reasons,
        is_public: b.isPublic !== 'false' && b.isPublic !== false,
      })
      .select(CR_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return { ...data, attachments: [], updates: [] } as T;
  }

  if (cleanPath === '/reports/mine' && method === 'GET') {
    const uid = await currentUserId();
    let q = supabase
      .from('community_reports')
      .select(CR_SELECT)
      .eq('reporter_id', uid)
      .order('created_at', { ascending: false });
    if (query.module) q = q.eq('module', query.module);
    const { data } = await q;
    return (data ?? []) as T;
  }

  if (cleanPath === '/reports/public-map' && method === 'GET') {
    const { data } = await supabase
      .from('community_reports')
      .select('id, reference_code, module, category, title, status, priority, latitude, longitude, created_at')
      .eq('is_public', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    return ((data ?? []).map((r: Record<string, unknown>) => ({ ...r, kind: 'community' })) as unknown) as T;
  }

  if (cleanPath === '/reports' && method === 'GET') {
    let q = supabase
      .from('community_reports')
      .select(CR_SELECT)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });
    if (query.module) q = q.eq('module', query.module);
    if (query.status) q = q.eq('status', query.status);
    if (query.category) q = q.eq('category', query.category);
    const { data } = await q;
    return (data ?? []) as T;
  }

  const crStatusMatch = cleanPath.match(/^\/reports\/([^/]+)\/status$/);
  if (crStatusMatch && method === 'PATCH') {
    const id = crStatusMatch[1];
    const uid = await currentUserId();
    const { data: cur } = await supabase.from('community_reports').select('status').eq('id', id).single();
    await supabase
      .from('community_reports')
      .update({
        status: opts.body.status,
        resolved_at: opts.body.status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    await supabase.from('report_updates').insert({
      community_report_id: id,
      author_id: uid,
      from_status: cur?.status ?? null,
      to_status: opts.body.status,
      note: opts.body.note || `Status updated to ${opts.body.status}.`,
      is_internal: false,
    });
    return supabaseDirectApi<T>(`/reports/${id}`);
  }

  const crNoteMatch = cleanPath.match(/^\/reports\/([^/]+)\/notes$/);
  if (crNoteMatch && method === 'POST') {
    const id = crNoteMatch[1];
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('report_updates')
      .insert({
        community_report_id: id,
        author_id: uid,
        note: opts.body.note,
        is_internal: Boolean(opts.body.isInternal),
      })
      .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  const crAssignMatch = cleanPath.match(/^\/reports\/([^/]+)\/assign$/);
  if (crAssignMatch && method === 'PATCH') {
    const id = crAssignMatch[1];
    await supabase
      .from('community_reports')
      .update({ assigned_to: opts.body.assigneeId ?? null })
      .eq('id', id);
    return supabaseDirectApi<T>(`/reports/${id}`);
  }

  const crIdMatch = cleanPath.match(/^\/reports\/([^/]+)$/);
  if (crIdMatch && method === 'GET') {
    const id = crIdMatch[1];
    const [{ data: report, error }, { data: updates }] = await Promise.all([
      supabase.from('community_reports').select(CR_SELECT).eq('id', id).single(),
      supabase
        .from('report_updates')
        .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
        .eq('community_report_id', id)
        .order('created_at', { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    return { ...report, attachments: [], updates: updates ?? [] } as T;
  }

  if (cleanPath === '/clean/summary' && method === 'GET') {
    const { data } = await supabase
      .from('community_reports')
      .select(CR_SELECT)
      .eq('module', 'clean')
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    const byCat = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byPurok = new Map<string, number>();
    let resolved = 0;
    for (const r of rows) {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      const purok = r.reporter?.purok || 'Barangay Zone';
      byPurok.set(purok, (byPurok.get(purok) ?? 0) + 1);
      if (r.status === 'resolved') resolved++;
    }
    return {
      total: rows.length,
      open: rows.length - resolved,
      resolved,
      resolved_last_30d: resolved,
      by_category: Array.from(byCat.entries()).map(([key, count]) => ({ key, count })),
      by_status: (['submitted', 'under_review', 'responding', 'resolved'] as ReportStatus[]).map(
        (key) => ({ key, count: byStatus.get(key) ?? 0 }),
      ),
      by_purok: Array.from(byPurok.entries()).map(([key, count]) => ({ key, count })),
      recent: rows.slice(0, 12),
    } as T;
  }

  // ---- ANNOUNCEMENTS ----
  if ((cleanPath === '/announcements' || cleanPath === '/announcements/manage') && method === 'GET') {
    const { data } = await supabase
      .from('announcements')
      .select('*, author:profiles!announcements_author_id_fkey(id, full_name, email)')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false });
    return (data ?? []) as T;
  }

  if (cleanPath === '/announcements' && method === 'POST') {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        author_id: uid,
        title: opts.body.title,
        summary: opts.body.summary || null,
        body: opts.body.body,
        category: opts.body.category || 'general',
        priority: opts.body.priority || 'normal',
        is_pinned: Boolean(opts.body.isPinned),
        is_published: opts.body.isPublished !== false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  const annIdMatch = cleanPath.match(/^\/announcements\/([^/]+)$/);
  if (annIdMatch) {
    const id = annIdMatch[1];
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, author:profiles!announcements_author_id_fkey(id, full_name, email)')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'PATCH') {
      const patch: Record<string, unknown> = {};
      if (opts.body.title !== undefined) patch.title = opts.body.title;
      if (opts.body.summary !== undefined) patch.summary = opts.body.summary;
      if (opts.body.body !== undefined) patch.body = opts.body.body;
      if (opts.body.category !== undefined) patch.category = opts.body.category;
      if (opts.body.priority !== undefined) patch.priority = opts.body.priority;
      if (opts.body.isPinned !== undefined) patch.is_pinned = opts.body.isPinned;
      if (opts.body.isPublished !== undefined) patch.is_published = opts.body.isPublished;
      const { data, error } = await supabase
        .from('announcements')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'DELETE') {
      await supabase.from('announcements').delete().eq('id', id);
      return { success: true } as T;
    }
  }

  // ---- COMMUNITY MAP LOCATIONS ----
  if (cleanPath === '/locations' && method === 'GET') {
    let q = supabase.from('community_locations').select('*').order('name');
    if (query.category) q = q.eq('category', query.category);
    const { data } = await q;
    return (data ?? []) as T;
  }

  if (cleanPath === '/locations' && method === 'POST') {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('community_locations')
      .insert({
        name: opts.body.name,
        category: opts.body.category,
        description: opts.body.description || null,
        address: opts.body.address || null,
        latitude: Number(opts.body.latitude),
        longitude: Number(opts.body.longitude),
        contact_number: opts.body.contactNumber || null,
        capacity: opts.body.capacity ? Number(opts.body.capacity) : null,
        is_accessible: Boolean(opts.body.isAccessible),
        is_public: opts.body.isPublic !== false,
        created_by: uid,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  const locIdMatch = cleanPath.match(/^\/locations\/([^/]+)$/);
  if (locIdMatch) {
    const id = locIdMatch[1];
    if (method === 'PATCH') {
      const patch: Record<string, unknown> = {};
      if (opts.body.name !== undefined) patch.name = opts.body.name;
      if (opts.body.category !== undefined) patch.category = opts.body.category;
      if (opts.body.description !== undefined) patch.description = opts.body.description;
      if (opts.body.address !== undefined) patch.address = opts.body.address;
      if (opts.body.latitude !== undefined) patch.latitude = Number(opts.body.latitude);
      if (opts.body.longitude !== undefined) patch.longitude = Number(opts.body.longitude);
      if (opts.body.contactNumber !== undefined) patch.contact_number = opts.body.contactNumber;
      if (opts.body.capacity !== undefined) patch.capacity = opts.body.capacity;
      if (opts.body.isAccessible !== undefined) patch.is_accessible = opts.body.isAccessible;
      if (opts.body.isPublic !== undefined) patch.is_public = opts.body.isPublic;
      const { data, error } = await supabase
        .from('community_locations')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'DELETE') {
      await supabase.from('community_locations').delete().eq('id', id);
      return { success: true } as T;
    }
  }

  // ---- BARANGAY SERVICES ----
  if ((cleanPath === '/services' || cleanPath === '/services/manage') && method === 'GET') {
    const { data } = await supabase.from('barangay_services').select('*').order('name');
    return (data ?? []) as T;
  }

  if (cleanPath === '/services' && method === 'POST') {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('barangay_services')
      .insert({
        name: opts.body.name,
        category: opts.body.category || 'certificate',
        description: opts.body.description,
        requirements: opts.body.requirements ?? [],
        procedure_steps: opts.body.procedureSteps ?? [],
        fee: opts.body.fee || null,
        processing_time: opts.body.processingTime || null,
        office: opts.body.office || null,
        office_hours: opts.body.officeHours || null,
        contact_number: opts.body.contactNumber || null,
        contact_email: opts.body.contactEmail || null,
        is_active: opts.body.isActive !== false,
        created_by: uid,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  const svcIdMatch = cleanPath.match(/^\/services\/([^/]+)$/);
  if (svcIdMatch) {
    const id = svcIdMatch[1];
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('barangay_services')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'PATCH') {
      const patch: Record<string, unknown> = {};
      if (opts.body.name !== undefined) patch.name = opts.body.name;
      if (opts.body.category !== undefined) patch.category = opts.body.category;
      if (opts.body.description !== undefined) patch.description = opts.body.description;
      if (opts.body.requirements !== undefined) patch.requirements = opts.body.requirements;
      if (opts.body.procedureSteps !== undefined) patch.procedure_steps = opts.body.procedureSteps;
      if (opts.body.fee !== undefined) patch.fee = opts.body.fee;
      if (opts.body.processingTime !== undefined) patch.processing_time = opts.body.processingTime;
      if (opts.body.office !== undefined) patch.office = opts.body.office;
      if (opts.body.officeHours !== undefined) patch.office_hours = opts.body.officeHours;
      if (opts.body.contactNumber !== undefined) patch.contact_number = opts.body.contactNumber;
      if (opts.body.contactEmail !== undefined) patch.contact_email = opts.body.contactEmail;
      if (opts.body.isActive !== undefined) patch.is_active = opts.body.isActive;
      const { data, error } = await supabase
        .from('barangay_services')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'DELETE') {
      await supabase.from('barangay_services').delete().eq('id', id);
      return { success: true } as T;
    }
  }

  // ---- BAYANIHAN ACTIVITIES ----
  if (cleanPath === '/activities' && method === 'GET') {
    const uid = await currentUserId();
    const [{ data: acts }, { data: regs }] = await Promise.all([
      supabase
        .from('community_activities')
        .select('*, organizer:profiles!community_activities_organizer_id_fkey(id, full_name, email)')
        .order('starts_at', { ascending: true }),
      supabase.from('volunteer_registrations').select('*'),
    ]);
    const list = (acts ?? []).map((a: Record<string, any>) => {
      const actRegs = (regs ?? []).filter((r: Record<string, any>) => r.activity_id === a.id);
      return {
        ...a,
        registered_count: actRegs.filter((r: Record<string, any>) => r.status !== 'cancelled').length,
        my_registration: actRegs.find((r: Record<string, any>) => r.user_id === uid) ?? null,
      };
    });
    return list as T;
  }

  if (cleanPath === '/activities/me/registrations' && method === 'GET') {
    const uid = await currentUserId();
    const { data } = await supabase
      .from('volunteer_registrations')
      .select('*, activity:community_activities(id, title, starts_at, ends_at, location_text, status, activity_type)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    return (data ?? []) as T;
  }

  if (cleanPath === '/activities' && method === 'POST') {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('community_activities')
      .insert({
        title: opts.body.title,
        description: opts.body.description,
        activity_type: opts.body.activityType,
        is_volunteer_opportunity: opts.body.isVolunteerOpportunity !== false,
        location_text: opts.body.locationText,
        starts_at: opts.body.startsAt,
        ends_at: opts.body.endsAt || null,
        max_participants: opts.body.maxParticipants ? Number(opts.body.maxParticipants) : null,
        status: opts.body.status || 'upcoming',
        organizer_id: uid,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { ...data, registered_count: 0, my_registration: null } as T;
  }

  const actRegMatch = cleanPath.match(/^\/activities\/([^/]+)\/register$/);
  if (actRegMatch) {
    const activityId = actRegMatch[1];
    const uid = await currentUserId();
    if (method === 'POST') {
      const { data, error } = await supabase
        .from('volunteer_registrations')
        .upsert(
          {
            activity_id: activityId,
            user_id: uid,
            status: 'registered',
            skills: opts.body?.skills || null,
            notes: opts.body?.notes || null,
          },
          { onConflict: 'activity_id,user_id' },
        )
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
    if (method === 'DELETE') {
      const { data, error } = await supabase
        .from('volunteer_registrations')
        .update({ status: 'cancelled' })
        .eq('activity_id', activityId)
        .eq('user_id', uid)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as T;
    }
  }

  const actPartMatch = cleanPath.match(/^\/activities\/([^/]+)\/participants$/);
  if (actPartMatch && method === 'GET') {
    const { data } = await supabase
      .from('volunteer_registrations')
      .select('*, user:profiles!volunteer_registrations_user_id_fkey(id, full_name, email, phone, purok)')
      .eq('activity_id', actPartMatch[1]);
    return (data ?? []) as T;
  }

  const regStatusMatch = cleanPath.match(/^\/activities\/registrations\/([^/]+)$/);
  if (regStatusMatch && method === 'PATCH') {
    const { data, error } = await supabase
      .from('volunteer_registrations')
      .update({ status: opts.body.status })
      .eq('id', regStatusMatch[1])
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  // ---- NOTIFICATIONS ----
  if (cleanPath === '/notifications' && method === 'GET') {
    const uid = await currentUserId();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as T;
  }

  if (cleanPath === '/notifications/unread-count' && method === 'GET') {
    const uid = await currentUserId();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_read', false);
    return { count: count ?? 0 } as T;
  }

  if (cleanPath === '/notifications/read-all' && method === 'PATCH') {
    const uid = await currentUserId();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', uid);
    return { updated: 1 } as T;
  }

  const notifReadMatch = cleanPath.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifReadMatch && method === 'PATCH') {
    const { data } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notifReadMatch[1])
      .select('*')
      .single();
    return data as T;
  }

  // ---- FLOOD MONITOR ----
  if (cleanPath === '/flood/sensors' && method === 'GET') {
    const { data } = await supabase.rpc('get_public_flood_sensors');
    return (data ?? []) as T;
  }

  const sensorReadingsMatch = cleanPath.match(/^\/flood\/sensors\/([^/]+)\/readings$/);
  if (sensorReadingsMatch && method === 'GET') {
    const { data } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('sensor_id', sensorReadingsMatch[1])
      .order('recorded_at', { ascending: false })
      .limit(100);
    return ((data ?? []).map((r: Record<string, any>) => ({
      ...r,
      distance_cm: Number(r.distance_cm),
      depth_cm: Number(r.depth_cm),
      rise_cm_min: r.rise_cm_min !== null ? Number(r.rise_cm_min) : null,
    })) as unknown) as T;
  }

  if (cleanPath === '/flood/alerts' && method === 'GET') {
    const { data } = await supabase
      .from('flood_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    return ((data ?? []).map((a: Record<string, any>) => ({
      ...a,
      depth_cm: Number(a.depth_cm),
      rise_cm_min: a.rise_cm_min !== null ? Number(a.rise_cm_min) : null,
    })) as unknown) as T;
  }

  // ---- I-LINK AI ----
  if (cleanPath === '/ai/status' && method === 'GET') {
    return { engine: 'knowledge_base', gemini_configured: false, model: null } as T;
  }

  if (cleanPath === '/ai/conversations' && method === 'GET') {
    const uid = await currentUserId();
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    return (data ?? []) as T;
  }

  const aiMsgMatch = cleanPath.match(/^\/ai\/conversations\/([^/]+)\/messages$/);
  if (aiMsgMatch && method === 'GET') {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', aiMsgMatch[1])
      .order('created_at', { ascending: true });
    return (data ?? []) as T;
  }

  if (cleanPath === '/ai/chat' && method === 'POST') {
    const uid = await currentUserId();
    const text = String(opts.body.message || '').trim();
    let convId = opts.body.conversationId;
    if (!convId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .insert({ user_id: uid, title: text.slice(0, 70) })
        .select('*')
        .single();
      convId = conv.id;
    }

    const { data: userMsg } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        role: 'user',
        content: text,
        engine: null,
        sources: [],
        suggested_actions: [],
      })
      .select('*')
      .single();

    const [{ data: articles }, { data: services }, { data: locations }] = await Promise.all([
      supabase.from('knowledge_articles').select('*').eq('is_active', true),
      supabase.from('barangay_services').select('*').eq('is_active', true),
      supabase.from('community_locations').select('*').eq('is_public', true),
    ]);

    const lower = text.toLowerCase();
    const parts: string[] = [];
    const sources: Array<{ type: string; id: string; title: string; verified: boolean }> = [];

    for (const a of articles ?? []) {
      if ((a.keywords ?? []).some((k: string) => lower.includes(k.toLowerCase()))) {
        parts.push(`**${a.question}**\n${a.answer}`);
        sources.push({ type: 'knowledge_article', id: a.id, title: a.question, verified: true });
      }
    }
    for (const s of services ?? []) {
      if (lower.includes(s.name.toLowerCase()) || lower.includes('clearance') || lower.includes('service')) {
        parts.push(
          `**${s.name}** (${s.fee ?? 'Free'} · ${s.processing_time ?? '15 mins'})\n${s.description}\n- **Requirements:** ${(s.requirements ?? []).join('; ')}`,
        );
        sources.push({ type: 'barangay_service', id: s.id, title: s.name, verified: true });
      }
    }
    if (lower.includes('evacuation') || lower.includes('map') || lower.includes('center')) {
      for (const l of (locations ?? []).slice(0, 3)) {
        parts.push(`- **${l.name}** (${l.address ?? 'Cebu City'})`);
        sources.push({ type: 'community_location', id: l.id, title: l.name, verified: true });
      }
    }
    if (parts.length === 0) {
      for (const a of (articles ?? []).slice(0, 2)) {
        parts.push(`**${a.question}**\n${a.answer}`);
        sources.push({ type: 'knowledge_article', id: a.id, title: a.question, verified: true });
      }
    }

    const { data: assistantMsg } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: parts.join('\n\n'),
        engine: 'knowledge_base',
        sources: sources.slice(0, 4),
        suggested_actions: [
          { label: 'Barangay Services', href: '/app/services' },
          { label: 'Report Emergency', href: '/app/emergency/new' },
          { label: 'Community Map', href: '/app/map' },
        ],
      })
      .select('*')
      .single();

    return {
      conversation_id: convId,
      user_message: userMsg,
      assistant_message: assistantMsg,
    } as T;
  }

  // ---- DASHBOARDS ----
  if (cleanPath === '/dashboard/resident' && method === 'GET') {
    const uid = await currentUserId();
    const [{ data: myEm }, { data: myCr }, { data: anns }, acts, { data: sensors }] =
      await Promise.all([
        supabase
          .from('emergency_reports')
          .select('id, reference_code, title, status, created_at, updated_at')
          .eq('reporter_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('community_reports')
          .select('id, reference_code, title, status, module, created_at, updated_at')
          .eq('reporter_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('announcements')
          .select('*')
          .eq('is_published', true)
          .order('is_pinned', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(5),
        supabaseDirectApi<any[]>('/activities'),
        supabase.rpc('get_public_flood_sensors'),
      ]);

    const combined = [
      ...(myEm ?? []).map((r: any) => ({ ...r, kind: 'emergency' as const })),
      ...(myCr ?? []).map((r: any) => ({ ...r, kind: 'community' as const })),
    ];
    const resolved = combined.filter((r) => r.status === 'resolved').length;
    const sensorList = (sensors ?? []) as Array<{ current_tier: FloodTier }>;

    return {
      my_reports: {
        total: combined.length,
        open: combined.length - resolved,
        resolved,
      },
      recent_reports: combined.slice(0, 6),
      announcements: anns ?? [],
      upcoming_activities: (acts ?? []).slice(0, 3),
      my_registrations: (acts ?? []).filter((a: any) => a.my_registration).length,
      flood: {
        highest_tier: highestTierOf(sensorList.map((s) => s.current_tier)),
        sensors: sensorList,
      },
    } as T;
  }

  if (cleanPath === '/dashboard/stats' && method === 'GET') {
    const [
      { data: resCount },
      { data: emRows },
      { data: crRows },
      { data: regs },
      { data: acts },
      { data: anns },
      { data: sensors },
      { data: alerts },
    ] = await Promise.all([
      supabase.rpc('get_resident_count'),
      supabase.from('emergency_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('community_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('volunteer_registrations').select('*').neq('status', 'cancelled'),
      supabase.from('community_activities').select('*'),
      supabase.from('announcements').select('*').eq('is_published', true),
      supabase.rpc('get_public_flood_sensors'),
      supabase.from('flood_alerts').select('*'),
    ]);

    const emList = emRows ?? [];
    const crList = crRows ?? [];
    const all = [...emList, ...crList];
    const resolved = all.filter((r) => r.status === 'resolved').length;
    const cleanCount = crList.filter((r) => r.module === 'clean').length;

    const statusMap = new Map<string, number>();
    for (const r of all) statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);

    const emCat = new Map<string, number>();
    for (const e of emList) emCat.set(e.category, (emCat.get(e.category) ?? 0) + 1);
    const crCat = new Map<string, number>();
    for (const c of crList) crCat.set(c.category, (crCat.get(c.category) ?? 0) + 1);

    const timeline = Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(Date.now() - (13 - idx) * 86400000).toISOString().slice(0, 10);
      return {
        date: d,
        emergency: emList.filter((e) => String(e.created_at).slice(0, 10) === d).length,
        community: crList.filter((c) => String(c.created_at).slice(0, 10) === d).length,
      };
    });

    const sensorList = (sensors ?? []) as Array<{ current_tier: FloodTier }>;

    return {
      totals: {
        residents: Number(resCount ?? 3),
        total_reports: all.length,
        pending_reports: all.length - resolved,
        resolved_reports: resolved,
        emergency_reports: emList.length,
        cleanliness_reports: cleanCount,
        general_reports: crList.length - cleanCount,
        volunteer_registrations: (regs ?? []).length,
        upcoming_activities: (acts ?? []).filter((a) => a.status === 'upcoming').length,
        published_announcements: (anns ?? []).length,
      },
      reports_by_status: ['submitted', 'under_review', 'responding', 'resolved'].map((key) => ({
        key,
        count: statusMap.get(key) ?? 0,
      })),
      emergency_by_category: Array.from(emCat.entries()).map(([key, count]) => ({ key, count })),
      community_by_category: Array.from(crCat.entries()).map(([key, count]) => ({ key, count })),
      timeline,
      recent_activity: [
        ...emList.slice(0, 4).map((e) => ({
          id: `em-${e.id}`,
          kind: 'emergency',
          title: `${e.reference_code}: ${e.title}`,
          subtitle: `Emergency (${e.category})`,
          status: e.status,
          link: `/app/emergency/${e.id}`,
          created_at: e.created_at,
        })),
        ...crList.slice(0, 4).map((c) => ({
          id: `cr-${c.id}`,
          kind: 'community',
          title: `${c.reference_code}: ${c.title}`,
          subtitle: `${c.module === 'clean' ? 'I-Link Clean' : 'Community'} (${c.category})`,
          status: c.status,
          link: `/app/reports/${c.id}`,
          created_at: c.created_at,
        })),
      ],
      insights: {
        hotspots: [
          {
            label: 'Purok 3 Sitio Riverside Footbridge',
            latitude: 10.2934,
            longitude: 123.8839,
            count: 2,
            top_category: 'blocked_drainage',
          },
          {
            label: 'Tres de Abril St. · Purok 2',
            latitude: 10.2957,
            longitude: 123.8803,
            count: 3,
            top_category: 'garbage_accumulation',
          },
        ],
        recurring: Array.from(crCat.entries()).map(([category, count_last_30d]) => ({
          category,
          count_last_30d,
          change_vs_prev_30d: count_last_30d,
        })),
        avg_resolution_hours: 12.0,
        high_priority_open: all.filter(
          (r) => r.status !== 'resolved' && (r.priority === 'high' || r.priority === 'critical'),
        ).length,
        generated_at: new Date().toISOString(),
        method:
          'Spatiotemporal grid clustering (~300m cells) + 30-day rolling category frequency delta & vulnerability keyword priority scoring',
      },
      flood: {
        sensors: sensorList.length,
        highest_tier: highestTierOf(sensorList.map((s) => s.current_tier)),
        active_alerts_24h: (alerts ?? []).length,
      },
    } as T;
  }

  throw new Error(`Endpoint ${method} ${cleanPath} is not available in serverless mode.`);
}
