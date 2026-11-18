import { Controller, Get, Global, Injectable, Module, Param, Patch } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../websockets/websockets.module';
import { CurrentUser } from '../common/decorators';
import { AppRole, AuthUser } from '../common/types';
import { unwrap, unwrapOne } from '../common/db';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listForUser(userId: string) {
    return unwrap(
      await this.supabase.admin
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      'Failed to load notifications',
    );
  }

  async unreadCount(userId: string) {
    const { count, error } = await this.supabase.admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  }

  async markRead(userId: string, id: string) {
    return unwrapOne(
      await this.supabase.admin
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single(),
      'Notification',
    );
  }

  async markAllRead(userId: string) {
    const rows = unwrap(
      await this.supabase.admin
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id'),
    );
    return { updated: rows?.length ?? 0 };
  }

  async createForUser(input: CreateNotificationInput) {
    const row = unwrap(
      await this.supabase.admin
        .from('notifications')
        .insert({
          user_id: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
          data: input.data ?? {},
        })
        .select('*')
        .single(),
      'Failed to create notification',
    );
    this.realtime.emitToUser(input.userId, 'notification:new', row);
    return row;
  }

  async notifyRoles(roles: AppRole[], payload: Omit<CreateNotificationInput, 'userId'>) {
    const { data: roleRows } = await this.supabase.admin
      .from('user_roles')
      .select('user_id')
      .in('role', roles);
    const userIds = Array.from(new Set((roleRows ?? []).map((r: { user_id: string }) => r.user_id)));
    if (userIds.length === 0) return [];

    const inserts = userIds.map((userId) => ({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      data: payload.data ?? {},
    }));
    const created = unwrap(
      await this.supabase.admin.from('notifications').insert(inserts).select('*'),
      'Failed to insert role notifications',
    );
    for (const row of created ?? []) {
      this.realtime.emitToUser(row.user_id, 'notification:new', row);
    }
    return created;
  }

  async notifyAllActiveUsers(payload: Omit<CreateNotificationInput, 'userId'>, excludeUserId?: string) {
    const { data: profiles } = await this.supabase.admin
      .from('profiles')
      .select('id')
      .eq('is_active', true);
    const userIds = (profiles ?? [])
      .map((p: { id: string }) => p.id)
      .filter((id: string) => id !== excludeUserId);
    if (userIds.length === 0) return [];

    const inserts = userIds.map((userId: string) => ({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      data: payload.data ?? {},
    }));
    const created = unwrap(
      await this.supabase.admin.from('notifications').insert(inserts).select('*'),
      'Failed to broadcast notifications',
    );
    for (const row of created ?? []) {
      this.realtime.emitToUser(row.user_id, 'notification:new', row);
    }
    return created;
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch('read-all')
  markAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  markOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
