import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseService } from './supabase/supabase.service';
import { AuthGuard, AuthModule, RolesGuard } from './auth/auth.module';
import { WebSocketsModule } from './websockets/websockets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { EmergencyModule } from './emergency/emergency.module';
import { ReportsModule } from './reports/reports.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { CommunityMapModule } from './community-map/community-map.module';
import { BarangayServicesModule } from './barangay-services/barangay-services.module';
import { BayanihanModule } from './bayanihan/bayanihan.module';
import { AiChatModule, AiChatService } from './ai-chat/ai-chat.module';
import { FloodModule } from './flood/flood.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { Public } from './common/decorators';

@Controller('health')
export class HealthController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly ai: AiChatService,
  ) {}

  @Public()
  @Get()
  async check() {
    const ok = await this.supabase.ping();
    return {
      status: 'ok',
      supabase: ok ? 'ok' : this.supabase.configured ? 'error' : 'unconfigured',
      ai_engine: this.ai.status().engine,
      time: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
    SupabaseModule,
    AuthModule,
    WebSocketsModule,
    NotificationsModule,
    UsersModule,
    EmergencyModule,
    ReportsModule,
    AnnouncementsModule,
    CommunityMapModule,
    BarangayServicesModule,
    BayanihanModule,
    AiChatModule,
    FloodModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
