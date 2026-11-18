import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../websockets/websockets.module';
import { NotificationsService } from '../notifications/notifications.module';
import { CurrentUser, Roles } from '../common/decorators';
import { ANNOUNCEMENT_PRIORITIES, AuthUser } from '../common/types';
import { toColumns, unwrap, unwrapOne } from '../common/db';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: 'normal' | 'important' | 'urgent';

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: 'normal' | 'important' | 'urgent';

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

const ANNOUNCEMENT_SELECT = `*, author:profiles!announcements_author_id_fkey(id, full_name, email)`;

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async listPublic(limit?: number) {
    const nowIso = new Date().toISOString();
    let builder = this.supabase.admin
      .from('announcements')
      .select(ANNOUNCEMENT_SELECT)
      .eq('is_published', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false });

    if (limit && limit > 0) builder = builder.limit(Math.min(limit, 100));
    return unwrap(await builder, 'Failed to load announcements');
  }

  async listManage() {
    return unwrap(
      await this.supabase.admin
        .from('announcements')
        .select(ANNOUNCEMENT_SELECT)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      'Failed to load announcements',
    );
  }

  async getOne(id: string) {
    return unwrapOne(
      await this.supabase.admin
        .from('announcements')
        .select(ANNOUNCEMENT_SELECT)
        .eq('id', id)
        .single(),
      'Announcement',
    );
  }

  async create(user: AuthUser, dto: CreateAnnouncementDto) {
    const isPublished = dto.isPublished !== undefined ? dto.isPublished : true;
    const row = unwrap(
      await this.supabase.admin
        .from('announcements')
        .insert({
          author_id: user.id,
          title: dto.title.trim(),
          summary: dto.summary?.trim() || null,
          body: dto.body.trim(),
          category: dto.category?.trim() || 'general',
          priority: dto.priority ?? 'normal',
          is_pinned: Boolean(dto.isPinned),
          is_published: isPublished,
          published_at: new Date().toISOString(),
          expires_at: dto.expiresAt ?? null,
        })
        .select(ANNOUNCEMENT_SELECT)
        .single(),
      'Failed to create announcement',
    );

    if (isPublished) {
      this.realtime.emitToAll('announcement:new', row);
      this.realtime.notifyDashboardRefresh('announcement:new');
      await this.notifications.notifyAllActiveUsers(
        {
          type: 'announcement',
          title: `${row.priority === 'urgent' ? '[URGENT] ' : ''}Barangay Announcement: ${row.title}`,
          body: (row.summary || row.body).slice(0, 180),
          link: `/app/announcements/${row.id}`,
          data: { announcementId: row.id, priority: row.priority },
        },
        user.id,
      );
    }

    return row;
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const patch = toColumns(dto, {
      title: 'title',
      summary: 'summary',
      body: 'body',
      category: 'category',
      priority: 'priority',
      isPinned: 'is_pinned',
      isPublished: 'is_published',
      expiresAt: 'expires_at',
    });
    const updated = unwrapOne(
      await this.supabase.admin
        .from('announcements')
        .update(patch)
        .eq('id', id)
        .select(ANNOUNCEMENT_SELECT)
        .single(),
      'Announcement',
    );
    if (updated.is_published) {
      this.realtime.emitToAll('announcement:new', updated);
    }
    this.realtime.notifyDashboardRefresh('announcement:updated');
    return updated;
  }

  async remove(id: string) {
    unwrap(
      await this.supabase.admin.from('announcements').delete().eq('id', id),
      'Failed to delete announcement',
    );
    this.realtime.notifyDashboardRefresh('announcement:deleted');
    return { success: true };
  }
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.announcements.listPublic(limit ? Number(limit) : undefined);
  }

  @Roles('admin')
  @Get('manage')
  listManage() {
    return this.announcements.listManage();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.announcements.getOne(id);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.announcements.remove(id);
  }
}

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
