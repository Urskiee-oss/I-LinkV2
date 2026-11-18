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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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
  EMERGENCY_CATEGORIES,
  EmergencyCategory,
  isStaff,
  REPORT_STATUSES,
  ReportStatus,
} from '../common/types';
import { unwrap, unwrapOne } from '../common/db';
import {
  hydrateAttachments,
  scoreEmergencyReport,
  uploadReportAttachment,
} from '../common/report-helpers';

export class CreateEmergencyDto {
  @IsIn(EMERGENCY_CATEGORIES)
  category!: EmergencyCategory;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  peopleAffected?: number;
}

export class UpdateReportStatusDto {
  @IsIn(REPORT_STATUSES)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AddReportNoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class AssignReportDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

const EMERGENCY_SELECT = `
  *,
  reporter:profiles!emergency_reports_reporter_id_fkey(id, full_name, email, phone, purok),
  assignee:profiles!emergency_reports_assigned_to_fkey(id, full_name, email, phone, purok)
`;

@Injectable()
export class EmergencyService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateEmergencyDto, file?: Express.Multer.File) {
    const triage = scoreEmergencyReport({
      category: dto.category,
      title: dto.title,
      description: dto.description,
      locationText: dto.locationText,
      peopleAffected: dto.peopleAffected ?? null,
    });

    const created = unwrap(
      await this.supabase.admin
        .from('emergency_reports')
        .insert({
          reporter_id: user.id,
          category: dto.category,
          title: dto.title.trim(),
          description: dto.description.trim(),
          location_text: dto.locationText.trim(),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          people_affected: dto.peopleAffected ?? null,
          status: 'submitted',
          priority: triage.priority,
          priority_score: triage.score,
          priority_reasons: triage.reasons,
        })
        .select(EMERGENCY_SELECT)
        .single(),
      'Failed to create emergency report',
    );

    if (file) {
      await uploadReportAttachment({
        supabase: this.supabase,
        file,
        userId: user.id,
        kind: 'emergency',
        reportId: created.id,
      });
    }

    await this.supabase.admin.from('report_updates').insert({
      emergency_report_id: created.id,
      author_id: user.id,
      from_status: null,
      to_status: 'submitted',
      note: 'Emergency report submitted by resident.',
      is_internal: false,
    });

    const full = await this.getOne(user, created.id);
    this.realtime.emitToStaff('emergency:new', full);
    this.realtime.notifyDashboardRefresh('emergency:new');

    await this.notifications.notifyRoles(['admin', 'responder'], {
      type: 'emergency_new',
      title: `[${triage.priority.toUpperCase()}] Emergency: ${created.title}`,
      body: `${created.reference_code} · ${dto.category.replace(/_/g, ' ')} at ${dto.locationText}`,
      link: `/app/emergency/${created.id}`,
      data: { reportId: created.id, referenceCode: created.reference_code, priority: triage.priority },
    });

    return full;
  }

  async listMine(userId: string) {
    return unwrap(
      await this.supabase.admin
        .from('emergency_reports')
        .select(EMERGENCY_SELECT)
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false }),
    );
  }

  async listAll(user: AuthUser, query: { status?: string; category?: string; assigned?: string }) {
    let builder = this.supabase.admin
      .from('emergency_reports')
      .select(EMERGENCY_SELECT)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.status && REPORT_STATUSES.includes(query.status as ReportStatus)) {
      builder = builder.eq('status', query.status);
    }
    if (query.category && EMERGENCY_CATEGORIES.includes(query.category as EmergencyCategory)) {
      builder = builder.eq('category', query.category);
    }
    if (query.assigned === 'me') {
      builder = builder.eq('assigned_to', user.id);
    }

    return unwrap(await builder, 'Failed to list emergency reports');
  }

  async listForMap() {
    const rows = unwrap(
      await this.supabase.admin
        .from('emergency_reports')
        .select('id, reference_code, category, title, status, priority, latitude, longitude, created_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
    );
    return (rows ?? []).map((r: Record<string, unknown>) => ({ ...r, kind: 'emergency' as const }));
  }

  async getOne(user: AuthUser, id: string) {
    const report = unwrapOne(
      await this.supabase.admin
        .from('emergency_reports')
        .select(EMERGENCY_SELECT)
        .eq('id', id)
        .single(),
      'Emergency report',
    );

    const staff = isStaff(user);
    if (!staff && report.reporter_id !== user.id) {
      throw new ForbiddenException('You do not have access to this emergency report');
    }

    const [{ data: attachmentRows }, { data: updateRows }] = await Promise.all([
      this.supabase.admin
        .from('report_attachments')
        .select('*')
        .eq('emergency_report_id', id)
        .order('created_at', { ascending: true }),
      this.supabase.admin
        .from('report_updates')
        .select('*, author:profiles!report_updates_author_id_fkey(id, full_name, email)')
        .eq('emergency_report_id', id)
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
      await this.supabase.admin.from('emergency_reports').select('*').eq('id', id).single(),
      'Emergency report',
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
        .from('emergency_reports')
        .update(patch)
        .eq('id', id)
        .select('id')
        .single(),
      'Emergency report',
    );

    await this.supabase.admin.from('report_updates').insert({
      emergency_report_id: id,
      author_id: user.id,
      from_status: current.status,
      to_status: dto.status,
      note: dto.note?.trim() || `Status updated to ${dto.status.replace(/_/g, ' ')}.`,
      is_internal: false,
    });

    const updated = await this.getOne(user, id);
    this.realtime.emitToStaff('emergency:updated', updated);
    this.realtime.emitToUser(current.reporter_id, 'emergency:updated', updated);
    this.realtime.notifyDashboardRefresh('emergency:status');

    if (current.reporter_id !== user.id) {
      await this.notifications.createForUser({
        userId: current.reporter_id,
        type: 'report_status',
        title: `Emergency ${current.reference_code}: ${dto.status.replace(/_/g, ' ').toUpperCase()}`,
        body: dto.note?.trim() || `Your report "${current.title}" is now ${dto.status.replace(/_/g, ' ')}.`,
        link: `/app/emergency/${id}`,
        data: { reportId: id, status: dto.status },
      });
    }

    return updated;
  }

  async addNote(user: AuthUser, id: string, dto: AddReportNoteDto) {
    const current = unwrapOne(
      await this.supabase.admin.from('emergency_reports').select('*').eq('id', id).single(),
      'Emergency report',
    );

    const noteRow = unwrap(
      await this.supabase.admin
        .from('report_updates')
        .insert({
          emergency_report_id: id,
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
    this.realtime.emitToStaff('emergency:updated', updated);
    if (!dto.isInternal) {
      this.realtime.emitToUser(current.reporter_id, 'emergency:updated', updated);
      if (current.reporter_id !== user.id) {
        await this.notifications.createForUser({
          userId: current.reporter_id,
          type: 'report_status',
          title: `Responder update on ${current.reference_code}`,
          body: dto.note.trim().slice(0, 180),
          link: `/app/emergency/${id}`,
          data: { reportId: id },
        });
      }
    }

    return noteRow;
  }

  async assign(user: AuthUser, id: string, dto: AssignReportDto) {
    unwrapOne(
      await this.supabase.admin
        .from('emergency_reports')
        .update({ assigned_to: dto.assigneeId ?? null })
        .eq('id', id)
        .select('id')
        .single(),
      'Emergency report',
    );

    const updated = await this.getOne(user, id);
    this.realtime.emitToStaff('emergency:updated', updated);
    if (dto.assigneeId) {
      await this.notifications.createForUser({
        userId: dto.assigneeId,
        type: 'emergency_new',
        title: `Assigned emergency: ${updated.reference_code}`,
        body: updated.title,
        link: `/app/emergency/${id}`,
        data: { reportId: id },
      });
    }
    return updated;
  }
}

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEmergencyDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.emergency.create(user, dto, file);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.emergency.listMine(user.id);
  }

  @Roles('admin', 'responder')
  @Get('map')
  listMap() {
    return this.emergency.listForMap();
  }

  @Roles('admin', 'responder')
  @Get()
  listAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('assigned') assigned?: string,
  ) {
    return this.emergency.listAll(user, { status, category, assigned });
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.emergency.getOne(user, id);
  }

  @Roles('admin', 'responder')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.emergency.updateStatus(user, id, dto);
  }

  @Roles('admin', 'responder')
  @Post(':id/notes')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddReportNoteDto,
  ) {
    return this.emergency.addNote(user, id, dto);
  }

  @Roles('admin')
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
  ) {
    return this.emergency.assign(user, id, dto);
  }
}

@Module({
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
