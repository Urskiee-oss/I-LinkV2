import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser, FLOOD_TIERS, FloodTier, REPORT_STATUSES, ReportStatus } from '../common/types';
import { unwrap } from '../common/db';
import { BayanihanModule, BayanihanService } from '../bayanihan/bayanihan.module';
import { FloodModule, FloodService } from '../flood/flood.module';

function highestTierOf(tiers: FloodTier[]): FloodTier {
  let maxIdx = 0;
  for (const t of tiers) {
    const idx = FLOOD_TIERS.indexOf(t);
    if (idx > maxIdx) maxIdx = idx;
  }
  return FLOOD_TIERS[maxIdx];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly bayanihan: BayanihanService,
    private readonly flood: FloodService,
  ) {}

  async getStaffStats() {
    const now = Date.now();
    const since24h = new Date(now - 24 * 3600 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const since60d = new Date(now - 60 * 24 * 3600 * 1000).toISOString();
    const nowIso = new Date(now).toISOString();

    const [
      { data: roleRows },
      { data: emergencyRows },
      { data: communityRows },
      { data: regRows },
      { data: activityRows },
      { data: announcementRows },
      { data: sensorRows },
      { data: alertRows },
    ] = await Promise.all([
      this.supabase.admin.from('user_roles').select('user_id, role'),
      this.supabase.admin
        .from('emergency_reports')
        .select(
          'id, reference_code, category, title, location_text, latitude, longitude, status, priority, priority_score, created_at, resolved_at',
        )
        .order('created_at', { ascending: false }),
      this.supabase.admin
        .from('community_reports')
        .select(
          'id, reference_code, module, category, title, location_text, latitude, longitude, status, priority, priority_score, created_at, resolved_at',
        )
        .order('created_at', { ascending: false }),
      this.supabase.admin
        .from('volunteer_registrations')
        .select('id, status, created_at, activity:community_activities(id, title)')
        .order('created_at', { ascending: false }),
      this.supabase.admin.from('community_activities').select('id, status'),
      this.supabase.admin
        .from('announcements')
        .select('id, title, priority, is_published, expires_at, created_at')
        .order('created_at', { ascending: false }),
      this.supabase.admin.from('flood_sensors').select('id, current_tier').eq('is_active', true),
      this.supabase.admin
        .from('flood_alerts')
        .select('id, tier, message, created_at, sensor:flood_sensors(name)')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false }),
    ]);

    const residentUserIds = new Set(
      (roleRows ?? [])
        .filter((r: { role: string }) => r.role === 'resident')
        .map((r: { user_id: string }) => r.user_id),
    );

    const emList = emergencyRows ?? [];
    const crList = communityRows ?? [];
    const allReports = [
      ...emList.map((r) => ({ ...r, kind: 'emergency' as const })),
      ...crList.map((r) => ({ ...r, kind: 'community' as const })),
    ];

    const resolvedReports = allReports.filter((r) => r.status === 'resolved').length;
    const pendingReports = allReports.length - resolvedReports;
    const cleanlinessReports = crList.filter((r) => r.module === 'clean').length;
    const generalReports = crList.length - cleanlinessReports;

    const activeRegs = (regRows ?? []).filter((r: { status: string }) => r.status !== 'cancelled');
    const upcomingActivities = (activityRows ?? []).filter(
      (a: { status: string }) => a.status === 'upcoming' || a.status === 'ongoing',
    ).length;

    const publishedAnnouncements = (announcementRows ?? []).filter(
      (a: { is_published: boolean; expires_at: string | null }) =>
        a.is_published && (!a.expires_at || a.expires_at > nowIso),
    ).length;

    // Status distribution across all reports
    const statusMap = new Map<ReportStatus, number>();
    for (const r of allReports) {
      statusMap.set(r.status as ReportStatus, (statusMap.get(r.status as ReportStatus) ?? 0) + 1);
    }
    const reportsByStatus = REPORT_STATUSES.map((key) => ({
      key,
      count: statusMap.get(key) ?? 0,
    }));

    // Category breakdowns
    const emCatMap = new Map<string, number>();
    for (const e of emList) {
      emCatMap.set(e.category, (emCatMap.get(e.category) ?? 0) + 1);
    }
    const crCatMap = new Map<string, number>();
    for (const c of crList) {
      crCatMap.set(c.category, (crCatMap.get(c.category) ?? 0) + 1);
    }

    // 14-day timeline
    const timelineDays: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      timelineDays.push(d);
    }
    const emByDay = new Map<string, number>();
    const crByDay = new Map<string, number>();
    for (const e of emList) {
      const day = (e.created_at as string).slice(0, 10);
      emByDay.set(day, (emByDay.get(day) ?? 0) + 1);
    }
    for (const c of crList) {
      const day = (c.created_at as string).slice(0, 10);
      crByDay.set(day, (crByDay.get(day) ?? 0) + 1);
    }
    const timeline = timelineDays.map((date) => ({
      date,
      emergency: emByDay.get(date) ?? 0,
      community: crByDay.get(date) ?? 0,
    }));

    // Spatial hotspot clustering (~300m grid cell: 0.003 deg lat/lng)
    const cells = new Map<
      string,
      {
        latSum: number;
        lngSum: number;
        count: number;
        labels: string[];
        categories: Map<string, number>;
      }
    >();
    for (const r of allReports) {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
      const cellKey = `${Math.round(r.latitude / 0.003)}:${Math.round(r.longitude / 0.003)}`;
      const entry = cells.get(cellKey) ?? {
        latSum: 0,
        lngSum: 0,
        count: 0,
        labels: [],
        categories: new Map<string, number>(),
      };
      entry.latSum += r.latitude;
      entry.lngSum += r.longitude;
      entry.count += 1;
      if (r.location_text && entry.labels.length < 3) entry.labels.push(r.location_text);
      entry.categories.set(r.category, (entry.categories.get(r.category) ?? 0) + 1);
      cells.set(cellKey, entry);
    }

    const hotspots = Array.from(cells.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => {
        const topCat =
          Array.from(c.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
        return {
          label: c.labels[0] ?? 'Barangay cluster',
          latitude: Number((c.latSum / c.count).toFixed(5)),
          longitude: Number((c.lngSum / c.count).toFixed(5)),
          count: c.count,
          top_category: topCat,
        };
      });

    // Recurring concern trends (last 30d vs previous 30d)
    const catLast30 = new Map<string, number>();
    const catPrev30 = new Map<string, number>();
    for (const r of allReports) {
      if (r.created_at >= since30d) {
        catLast30.set(r.category, (catLast30.get(r.category) ?? 0) + 1);
      } else if (r.created_at >= since60d) {
        catPrev30.set(r.category, (catPrev30.get(r.category) ?? 0) + 1);
      }
    }
    const recurring = Array.from(catLast30.entries())
      .map(([category, countLast30d]) => ({
        category,
        count_last_30d: countLast30d,
        change_vs_prev_30d: countLast30d - (catPrev30.get(category) ?? 0),
      }))
      .sort((a, b) => b.count_last_30d - a.count_last_30d)
      .slice(0, 6);

    // Average resolution time in hours
    const resolvedDurationsHours: number[] = [];
    for (const r of allReports) {
      if (r.status === 'resolved' && r.resolved_at) {
        const hrs =
          (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
        if (hrs >= 0 && hrs < 24 * 90) resolvedDurationsHours.push(hrs);
      }
    }
    const avgResolutionHours =
      resolvedDurationsHours.length > 0
        ? Number(
            (
              resolvedDurationsHours.reduce((acc, v) => acc + v, 0) /
              resolvedDurationsHours.length
            ).toFixed(1),
          )
        : null;

    const highPriorityOpen = allReports.filter(
      (r) => r.status !== 'resolved' && (r.priority === 'high' || r.priority === 'critical'),
    ).length;

    // Recent activity feed
    const recentActivity = [
      ...emList.slice(0, 5).map((e) => ({
        id: `em-${e.id}`,
        kind: 'emergency' as const,
        title: `${e.reference_code}: ${e.title}`,
        subtitle: `Emergency (${e.category.replace(/_/g, ' ')}) · ${e.location_text}`,
        status: e.status,
        link: `/app/emergency/${e.id}`,
        created_at: e.created_at,
      })),
      ...crList.slice(0, 5).map((c) => ({
        id: `cr-${c.id}`,
        kind: 'community' as const,
        title: `${c.reference_code}: ${c.title}`,
        subtitle: `${c.module === 'clean' ? 'I-Link Clean' : 'Community'} (${c.category.replace(/_/g, ' ')})`,
        status: c.status,
        link: `/app/reports/${c.id}`,
        created_at: c.created_at,
      })),
      ...(announcementRows ?? []).slice(0, 3).map((a: { id: string; title: string; priority: string; created_at: string }) => ({
        id: `ann-${a.id}`,
        kind: 'announcement' as const,
        title: a.title,
        subtitle: `Announcement (${a.priority})`,
        link: `/app/announcements/${a.id}`,
        created_at: a.created_at,
      })),
      ...(alertRows ?? []).slice(0, 3).map((al: { id: string; tier: string; message: string; created_at: string }) => ({
        id: `fl-${al.id}`,
        kind: 'flood_alert' as const,
        title: `Flood alert (${al.tier.toUpperCase()})`,
        subtitle: al.message,
        link: `/app/flood`,
        created_at: al.created_at,
      })),
    ]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10);

    const sensorTiers = (sensorRows ?? []).map((s: { current_tier: FloodTier }) => s.current_tier);

    return {
      totals: {
        residents: residentUserIds.size,
        total_reports: allReports.length,
        pending_reports: pendingReports,
        resolved_reports: resolvedReports,
        emergency_reports: emList.length,
        cleanliness_reports: cleanlinessReports,
        general_reports: generalReports,
        volunteer_registrations: activeRegs.length,
        upcoming_activities: upcomingActivities,
        published_announcements: publishedAnnouncements,
      },
      reports_by_status: reportsByStatus,
      emergency_by_category: Array.from(emCatMap.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      community_by_category: Array.from(crCatMap.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      timeline,
      recent_activity: recentActivity,
      insights: {
        hotspots,
        recurring,
        avg_resolution_hours: avgResolutionHours,
        high_priority_open: highPriorityOpen,
        generated_at: new Date().toISOString(),
        method:
          'Spatiotemporal grid clustering (~300m cells) + 30-day rolling category frequency delta & vulnerability keyword priority scoring',
      },
      flood: {
        sensors: (sensorRows ?? []).length,
        highest_tier: highestTierOf(sensorTiers),
        active_alerts_24h: (alertRows ?? []).length,
      },
    };
  }

  async getResidentDashboard(user: AuthUser) {
    const nowIso = new Date().toISOString();
    const [
      { data: myEm },
      { data: myCr },
      { data: announcements },
      activities,
      { count: myRegsCount },
      sensors,
    ] = await Promise.all([
      this.supabase.admin
        .from('emergency_reports')
        .select('id, reference_code, title, status, created_at, updated_at')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false }),
      this.supabase.admin
        .from('community_reports')
        .select('id, reference_code, title, status, module, created_at, updated_at')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false }),
      this.supabase.admin
        .from('announcements')
        .select('*, author:profiles!announcements_author_id_fkey(id, full_name)')
        .eq('is_published', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(5),
      this.bayanihan.list(user, { status: 'upcoming' }),
      this.supabase.admin
        .from('volunteer_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'cancelled'),
      this.flood.listSensors(),
    ]);

    const combined = [
      ...(myEm ?? []).map((r) => ({ ...r, kind: 'emergency' as const })),
      ...(myCr ?? []).map((r) => ({ ...r, kind: 'community' as const })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const resolved = combined.filter((r) => r.status === 'resolved').length;
    const sensorTiers = sensors.map(
      (s: { current_tier?: FloodTier }) => s.current_tier ?? 'normal',
    );

    return {
      my_reports: {
        total: combined.length,
        open: combined.length - resolved,
        resolved,
      },
      recent_reports: combined.slice(0, 6),
      announcements: unwrap({ data: announcements ?? [], error: null }),
      upcoming_activities: activities.slice(0, 3),
      my_registrations: myRegsCount ?? 0,
      flood: {
        highest_tier: highestTierOf(sensorTiers),
        sensors,
      },
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('admin', 'responder')
  @Get('stats')
  stats() {
    return this.dashboard.getStaffStats();
  }

  @Get('resident')
  resident(@CurrentUser() user: AuthUser) {
    return this.dashboard.getResidentDashboard(user);
  }
}

@Module({
  imports: [BayanihanModule, FloodModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
