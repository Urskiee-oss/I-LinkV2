import {
  BadRequestException,
  Body,
  ConflictException,
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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  AuthUser,
  REGISTRATION_STATUSES,
} from '../common/types';
import { toColumns, unwrap, unwrapOne } from '../common/db';

export class CreateActivityDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsIn(ACTIVITY_TYPES)
  activityType!: (typeof ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isVolunteerOpportunity?: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(250)
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

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number | null;

  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: (typeof ACTIVITY_STATUSES)[number];
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  activityType?: (typeof ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isVolunteerOpportunity?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  locationText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number | null;

  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: (typeof ACTIVITY_STATUSES)[number];
}

export class RegisterActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  skills?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateRegistrationStatusDto {
  @IsIn(REGISTRATION_STATUSES)
  status!: (typeof REGISTRATION_STATUSES)[number];
}

const ACTIVITY_SELECT = `*, organizer:profiles!community_activities_organizer_id_fkey(id, full_name, email)`;

@Injectable()
export class BayanihanService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  private async enrichActivities(
    rows: Array<Record<string, unknown> & { id: string }>,
    userId: string,
  ) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const regs =
      unwrap(
        await this.supabase.admin
          .from('volunteer_registrations')
          .select('*')
          .in('activity_id', ids),
      ) ?? [];

    const countByActivity = new Map<string, number>();
    const mineByActivity = new Map<string, Record<string, unknown>>();

    for (const reg of regs as Array<
      Record<string, unknown> & { activity_id: string; user_id: string; status: string }
    >) {
      if (reg.status !== 'cancelled') {
        countByActivity.set(reg.activity_id, (countByActivity.get(reg.activity_id) ?? 0) + 1);
      }
      if (reg.user_id === userId) {
        mineByActivity.set(reg.activity_id, reg);
      }
    }

    return rows.map((row) => ({
      ...row,
      registered_count: countByActivity.get(row.id) ?? 0,
      my_registration: mineByActivity.get(row.id) ?? null,
    }));
  }

  async list(user: AuthUser, query: { status?: string; type?: string }) {
    let builder = this.supabase.admin
      .from('community_activities')
      .select(ACTIVITY_SELECT)
      .order('starts_at', { ascending: true });

    if (query.status && (ACTIVITY_STATUSES as readonly string[]).includes(query.status)) {
      builder = builder.eq('status', query.status);
    }
    if (query.type && (ACTIVITY_TYPES as readonly string[]).includes(query.type)) {
      builder = builder.eq('activity_type', query.type);
    }

    const rows = unwrap(await builder, 'Failed to load activities') ?? [];
    return this.enrichActivities(rows, user.id);
  }

  async getOne(user: AuthUser, id: string) {
    const row = unwrapOne(
      await this.supabase.admin
        .from('community_activities')
        .select(ACTIVITY_SELECT)
        .eq('id', id)
        .single(),
      'Activity',
    );
    const [enriched] = await this.enrichActivities([row], user.id);
    return enriched;
  }

  async create(user: AuthUser, dto: CreateActivityDto) {
    if (dto.endsAt && new Date(dto.endsAt) < new Date(dto.startsAt)) {
      throw new BadRequestException('End time must be after start time');
    }
    const created = unwrap(
      await this.supabase.admin
        .from('community_activities')
        .insert({
          title: dto.title.trim(),
          description: dto.description.trim(),
          activity_type: dto.activityType,
          is_volunteer_opportunity:
            dto.isVolunteerOpportunity !== undefined ? dto.isVolunteerOpportunity : true,
          location_text: dto.locationText.trim(),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          starts_at: dto.startsAt,
          ends_at: dto.endsAt ?? null,
          max_participants: dto.maxParticipants ?? null,
          status: dto.status ?? 'upcoming',
          organizer_id: user.id,
        })
        .select(ACTIVITY_SELECT)
        .single(),
      'Failed to create community activity',
    );

    this.realtime.emitToAll('activity:updated', { id: created.id, action: 'created' });
    this.realtime.notifyDashboardRefresh('activity:created');
    return this.getOne(user, created.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateActivityDto) {
    const patch = toColumns(dto, {
      title: 'title',
      description: 'description',
      activityType: 'activity_type',
      isVolunteerOpportunity: 'is_volunteer_opportunity',
      locationText: 'location_text',
      latitude: 'latitude',
      longitude: 'longitude',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      maxParticipants: 'max_participants',
      status: 'status',
    });

    unwrapOne(
      await this.supabase.admin
        .from('community_activities')
        .update(patch)
        .eq('id', id)
        .select('id')
        .single(),
      'Activity',
    );

    this.realtime.emitToAll('activity:updated', { id, action: 'updated' });
    this.realtime.notifyDashboardRefresh('activity:updated');
    return this.getOne(user, id);
  }

  async remove(id: string) {
    unwrap(
      await this.supabase.admin.from('community_activities').delete().eq('id', id),
      'Failed to delete activity',
    );
    this.realtime.emitToAll('activity:updated', { id, action: 'deleted' });
    this.realtime.notifyDashboardRefresh('activity:deleted');
    return { success: true };
  }

  async register(user: AuthUser, activityId: string, dto: RegisterActivityDto) {
    const activity = unwrapOne(
      await this.supabase.admin
        .from('community_activities')
        .select('*')
        .eq('id', activityId)
        .single(),
      'Activity',
    );

    if (activity.status === 'cancelled' || activity.status === 'completed') {
      throw new BadRequestException(`Cannot register for a ${activity.status} activity`);
    }

    const { data: existing } = await this.supabase.admin
      .from('volunteer_registrations')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing && existing.status !== 'cancelled') {
      throw new ConflictException('You are already registered for this activity');
    }

    if (activity.max_participants) {
      const { count } = await this.supabase.admin
        .from('volunteer_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', activityId)
        .neq('status', 'cancelled');

      if ((count ?? 0) >= activity.max_participants) {
        throw new ConflictException('All volunteer slots for this activity are currently full');
      }
    }

    let reg;
    if (existing) {
      reg = unwrapOne(
        await this.supabase.admin
          .from('volunteer_registrations')
          .update({
            status: 'registered',
            skills: dto.skills?.trim() || null,
            notes: dto.notes?.trim() || null,
          })
          .eq('id', existing.id)
          .select('*')
          .single(),
      );
    } else {
      reg = unwrap(
        await this.supabase.admin
          .from('volunteer_registrations')
          .insert({
            activity_id: activityId,
            user_id: user.id,
            status: 'registered',
            skills: dto.skills?.trim() || null,
            notes: dto.notes?.trim() || null,
          })
          .select('*')
          .single(),
        'Failed to register for activity',
      );
    }

    this.realtime.emitToAll('activity:updated', { id: activityId, action: 'registration' });
    this.realtime.notifyDashboardRefresh('activity:registration');
    return reg;
  }

  async cancelRegistration(user: AuthUser, activityId: string) {
    const reg = unwrapOne(
      await this.supabase.admin
        .from('volunteer_registrations')
        .update({ status: 'cancelled' })
        .eq('activity_id', activityId)
        .eq('user_id', user.id)
        .select('*')
        .single(),
      'Registration',
    );
    this.realtime.emitToAll('activity:updated', { id: activityId, action: 'registration' });
    this.realtime.notifyDashboardRefresh('activity:registration');
    return reg;
  }

  async myRegistrations(userId: string) {
    return unwrap(
      await this.supabase.admin
        .from('volunteer_registrations')
        .select(
          '*, activity:community_activities(id, title, starts_at, ends_at, location_text, status, activity_type)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      'Failed to load your registrations',
    );
  }

  async listParticipants(activityId: string) {
    return unwrap(
      await this.supabase.admin
        .from('volunteer_registrations')
        .select(
          '*, user:profiles!volunteer_registrations_user_id_fkey(id, full_name, email, phone, purok)',
        )
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true }),
      'Failed to load activity participants',
    );
  }

  async updateRegistrationStatus(registrationId: string, dto: UpdateRegistrationStatusDto) {
    const updated = unwrapOne(
      await this.supabase.admin
        .from('volunteer_registrations')
        .update({ status: dto.status })
        .eq('id', registrationId)
        .select(
          '*, user:profiles!volunteer_registrations_user_id_fkey(id, full_name, email, phone, purok), activity:community_activities(id, title)',
        )
        .single(),
      'Registration',
    );

    await this.notifications.createForUser({
      userId: updated.user_id,
      type: 'activity',
      title: `Bayanihan registration ${dto.status.toUpperCase()}`,
      body: `Your registration for "${updated.activity?.title ?? 'community activity'}" is now ${dto.status}.`,
      link: `/app/bayanihan`,
      data: { activityId: updated.activity_id, registrationId },
    });

    this.realtime.emitToAll('activity:updated', {
      id: updated.activity_id,
      action: 'registration',
    });
    return updated;
  }
}

@Controller('activities')
export class BayanihanController {
  constructor(private readonly bayanihan: BayanihanService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.bayanihan.list(user, { status, type });
  }

  @Get('me/registrations')
  myRegistrations(@CurrentUser() user: AuthUser) {
    return this.bayanihan.myRegistrations(user.id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bayanihan.getOne(user, id);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityDto) {
    return this.bayanihan.create(user, dto);
  }

  @Roles('admin')
  @Patch('registrations/:registrationId')
  updateRegStatus(
    @Param('registrationId') registrationId: string,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.bayanihan.updateRegistrationStatus(registrationId, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.bayanihan.update(user, id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bayanihan.remove(id);
  }

  @Post(':id/register')
  register(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RegisterActivityDto,
  ) {
    return this.bayanihan.register(user, id, dto);
  }

  @Delete(':id/register')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bayanihan.cancelRegistration(user, id);
  }

  @Roles('admin', 'responder')
  @Get(':id/participants')
  participants(@Param('id') id: string) {
    return this.bayanihan.listParticipants(id);
  }
}

@Module({
  controllers: [BayanihanController],
  providers: [BayanihanService],
  exports: [BayanihanService],
})
export class BayanihanModule {}
