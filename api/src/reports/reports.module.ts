import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../websockets/websockets.module';
import { NotificationsService } from '../notifications/notifications.module';
import { CurrentUser, Roles } from '../common/decorators';
import {
  AuthUser,
  CLEAN_CATEGORIES,
  COMMUNITY_CATEGORIES,
  CommunityCategory,
  isStaff,
  REPORT_STATUSES,
  ReportStatus,
} from '../common/types';
import { unwrap, unwrapOne } from '../common/db';
import {
  hydrateAttachments,
  scoreCommunityReport,
  uploadReportAttachment,
} from '../common/report-helpers';
import {
  AddReportNoteDto,
  AssignReportDto,
  UpdateReportStatusDto,
} from '../emergency/emergency.module';

export class CreateCommunityReportDto {
  @IsOptional()
  @IsIn(['clean', 'general'])
  module?: 'clean' | 'general';

  @IsIn(COMMUNITY_CATEGORIES)
  category!: CommunityCategory;

  @IsString()
  @MinLength(4)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  locationText!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'false' ? false : value === 'true' ? true : Boolean(value)))
  @IsBoolean()
  isPublic?: boolean;
}

const COMMUNITY_SELECT = `
  *,
  reporter:profiles!community_reports_reporter_id_fkey(id, full_name, email, phone, purok),
  assignee:profiles!community_reports_assigned_to_fkey(id, full_name, email, phone, purok)
`;

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateCommunityReportDto, file?: Express.Multer.File) {
    const inferredModule: 'clean' | 'general' =
      dto.module ??
      ((CLEAN_CATEGORIES as readonly string[]).includes(dto.category) ? 'clean' : 'general');

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { count: recentCount } = await this.supabase.admin
      .from('community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('category', dto.category)
      .gte('created_at', since30d);

    const triage = scoreCommunityReport({
      category: dto.category,
      title: dto.title,
      description: dto.description,
      locationText: dto.locationText,
      nearbyRecentCount: recentCount ?? 0,
    });

    const created = unwrap(
      await this.supabase.admin
        .from('community_reports')
        .insert({
          reporter_id: user.id,
          module: inferredModule,
          category: dto.category,
          title: dto.title.trim(),
          description: dto.description.trim(),
          location_text: dto.locationText.trim(),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          status: 'submitted',
          priority: triage.priority,
          priority_score: triage.score,
          priority_reasons: triage.reasons,
          is_public: dto.isPublic !== undefined ? dto.isPublic : true,
        })
        .select(COMMUNITY_SELECT)
        .single(),
      'Failed to create community report',
    );

    if (file) {
      await uploadReportAttachment({
        supabase: this.supabase,
        file,
        userId: user.id,
        kind: 'community',
        reportId: created.id,
      });
    }

    await this.supabase.admin.from('report_updates').insert({
      community_report_id: created.id,
      author_id: user.id,
      from_status: null,
      to_status: 'submitted',
      note: 'Community report submitted by resident.',
      is_internal: false,
    });

    const full = await this.getOne(user, created.id);
    this.realtime.emitToStaff('report:new', full);
    this.realtime.notifyDashboardRefresh('report:new');

    await this.notifications.notifyRoles(['admin', 'responder'], {
      type: 'report_new',
      title: `New ${inferredModule === 'clean' ? 'I-Link Clean' : 'Community'} Report: ${created.title}`,
      body: `${created.reference_code} · ${dto.category.replace(/_/g, ' ')} at ${dto.locationText}`,
      link: `/app/reports/${created.id}`,
      data: { reportId: created.id, module: inferredModule, priority: triage.priority },
    });

    return full;
  }

  async listMine(userId: string, moduleFilter?: string) {
    let builder = this.supabase.admin
      .from('community_reports')
      .select(COMMUNITY_SELECT)
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false });

    if (moduleFilter === 'clean' || moduleFilter === 'general') {
      builder = builder.eq('module', moduleFilter);
    }
    return unwrap(await builder, 'Failed to load your reports');
  }

  async listPublicMap() {
    const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const rows = unwrap(
      await this.supabase.admin
        .from('community_reports')
        .select(
          'id, reference_code, module, category, title, status, priority, latitude, longitude, created_at, resolved_at',
        )
        .eq('is_public', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
    );
    return (rows ?? [])
      .filter((r: { status: ReportStatus; resolved_at: string | null }) => {
        if (r.status !== 'resolved') return true;
        return !r.resolved_at || r.resolved_at >= cutoff;
      })
      .map((r: Record<string, unknown>) => ({ ...r, kind: 'community' as const }));
  }

  async listAll(query: { module?: string; status?: string; category?: string }) {
    let builder = this.supabase.admin
      .from('community_reports')
      .select(COMMUNITY_SELECT)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.module === 'clean' || query.module === 'general') {
      builder = builder.eq('module', query.module);
    }
    if (query.status && REPORT_STATUSES.includes(query.status as ReportStatus)) {
      builder = builder.eq('status', query.status);
    }
    if (query.category && (COMMUNITY_CATEGORIES as readonly string[]).includes(query.category)) {
      builder = builder.eq('category', query.category);
    }

    return unwrap(await builder, 'Failed to list community reports');
  }

  async getOne(user: AuthUser, id: string) {
    const report = unwrapOne(
      await this.supabase.admin
        .from('community_reports')
        .select(COMMUNITY_SELECT)
        .eq('id', id)
        .single(),
      'Community report',
    );

    const staff = isStaff(user);
    if (!staff && report.reporter_id !== user.id && !report.is_public) {
      throw new ForbiddenException('You do not have access to this report');
    }

    const [{ data: attachmentRows }, { data: updateRows }] = await Promise.all([
      this.supabase.admin
        .from('report_attachments')
        .select('*')
        .eq('community_report_id', id)
        .order('created_at', { ascending: true }),
      this.supabase.admin
        .from('report_updates')
        .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
        .eq('community_report_id', id)
        .order('created_at', { ascending: true }),
    ]);

    const attachments = await hydrateAttachments(this.supabase, attachmentRows ?? []);
    const updates = (updateRows ?? []).filter(
      (u: { is_internal: boolean }) => staff || !u.is_internal,
    );

    return {
      ...report,
      attachments,
      updates,
    };
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateReportStatusDto) {
    const current = unwrapOne(
      await this.supabase.admin.from('community_reports').select('*').eq('id', id).single(),
      'Community report',
    );

    const patch: Record<string, unknown> = {
      status: dto.status,
      resolved_at: dto.status === 'resolved' ? new Date().toISOString() : null,
    };
    if (!current.assigned_to && user.roles.includes('responder')) {
      patch.assigned_to = user.id;
    }

    unwrapOne(
      await this.supabase.admin
        .from('community_reports')
        .update(patch)
        .eq('id', id)
        .select('id')
        .single(),
      'Community report',
    );

    await this.supabase.admin.from('report_updates').insert({
      community_report_id: id,
      author_id: user.id,
      from_status: current.status,
      to_status: dto.status,
      note: dto.note?.trim() || `Status updated to ${dto.status.replace(/_/g, ' ')}.`,
      is_internal: false,
    });

    const updated = await this.getOne(user, id);
    this.realtime.emitToStaff('report:updated', updated);
    this.realtime.emitToUser(current.reporter_id, 'report:updated', updated);
    this.realtime.notifyDashboardRefresh('report:status');

    if (current.reporter_id !== user.id) {
      await this.notifications.createForUser({
        userId: current.reporter_id,
        type: 'report_status',
        title: `Report ${current.reference_code}: ${dto.status.replace(/_/g, ' ').toUpperCase()}`,
        body: dto.note?.trim() || `Your report "${current.title}" is now ${dto.status.replace(/_/g, ' ')}.`,
        link: `/app/reports/${id}`,
        data: { reportId: id, status: dto.status },
      });
    }

    return updated;
  }

  async addNote(user: AuthUser, id: string, dto: AddReportNoteDto) {
    const current = unwrapOne(
      await this.supabase.admin.from('community_reports').select('*').eq('id', id).single(),
      'Community report',
    );

    const noteRow = unwrap(
      await this.supabase.admin
        .from('report_updates')
        .insert({
          community_report_id: id,
          author_id: user.id,
          from_status: current.status,
          to_status: current.status,
          note: dto.note.trim(),
          is_internal: Boolean(dto.isInternal),
        })
        .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
        .single(),
    );

    const updated = await this.getOne(user, id);
    this.realtime.emitToStaff('report:updated', updated);
    if (!dto.isInternal) {
      this.realtime.emitToUser(current.reporter_id, 'report:updated', updated);
      if (current.reporter_id !== user.id) {
        await this.notifications.createForUser({
          userId: current.reporter_id,
          type: 'report_status',
          title: `Update on report ${current.reference_code}`,
          body: dto.note.trim().slice(0, 180),
          link: `/app/reports/${id}`,
          data: { reportId: id },
        });
      }
    }

    return noteRow;
  }

  async assign(user: AuthUser, id: string, dto: AssignReportDto) {
    unwrapOne(
      await this.supabase.admin
        .from('community_reports')
        .update({ assigned_to: dto.assigneeId ?? null })
        .eq('id', id)
        .select('id')
        .single(),
      'Community report',
    );

    const updated = await this.getOne(user, id);
    this.realtime.emitToStaff('report:updated', updated);
    if (dto.assigneeId) {
      await this.notifications.createForUser({
        userId: dto.assigneeId,
        type: 'report_new',
        title: `Assigned report: ${updated.reference_code}`,
        body: updated.title,
        link: `/app/reports/${id}`,
        data: { reportId: id },
      });
    }
    return updated;
  }

  async cleanSummary() {
    const rows =
      unwrap(
        await this.supabase.admin
          .from('community_reports')
          .select(COMMUNITY_SELECT)
          .eq('module', 'clean')
          .order('created_at', { ascending: false }),
      ) ?? [];

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const byCat = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byPurok = new Map<string, number>();
    let resolved = 0;
    let resolvedLast30d = 0;

    for (const r of rows as Array<{
      category: string;
      status: ReportStatus;
      resolved_at: string | null;
      location_text: string;
      reporter?: { purok?: string | null } | null;
    }>) {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      const purok =
        r.reporter?.purok ||
        (r.location_text.match(/purok\s*\d+|sitio\s*[a-z0-9]+/i)?.[0] ?? 'Unspecified');
      byPurok.set(purok, (byPurok.get(purok) ?? 0) + 1);
      if (r.status === 'resolved') {
        resolved += 1;
        if (r.resolved_at && r.resolved_at >= since30d) resolvedLast30d += 1;
      }
    }

    return {
      total: rows.length,
      open: rows.length - resolved,
      resolved,
      resolved_last_30d: resolvedLast30d,
      by_category: Array.from(byCat.entries()).map(([key, count]) => ({ key, count })),
      by_status: REPORT_STATUSES.map((key) => ({ key, count: byStatus.get(key) ?? 0 })),
      by_purok: Array.from(byPurok.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      recent: rows.slice(0, 12),
    };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommunityReportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.reports.create(user, dto, file);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser, @Query('module') moduleFilter?: string) {
    return this.reports.listMine(user.id, moduleFilter);
  }

  @Get('public-map')
  listPublicMap() {
    return this.reports.listPublicMap();
  }

  @Roles('admin', 'responder')
  @Get()
  listAll(
    @Query('module') moduleFilter?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.reports.listAll({ module: moduleFilter, status, category });
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getOne(user, id);
  }

  @Roles('admin', 'responder')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reports.updateStatus(user, id, dto);
  }

  @Roles('admin', 'responder')
  @Post(':id/notes')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddReportNoteDto,
  ) {
    return this.reports.addNote(user, id, dto);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
  ) {
    return this.reports.assign(user, id, dto);
  }
}

@Controller('clean')
export class CleanlinessController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary() {
    return this.reports.cleanSummary();
  }
}

@Module({
  controllers: [ReportsController, CleanlinessController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
