import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase access for the backend.
 *
 * - `admin`: service-role client. Bypasses RLS, so it is ONLY used after the
 *   NestJS guards have authenticated the caller and checked their role.
 * - `auth`: anon-key client used to validate end-user access tokens.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient!: SupabaseClient;
  private authClient!: SupabaseClient;
  readonly bucket: string;
  readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'report-attachments';
    const url = this.config.get<string>('SUPABASE_URL') ?? '';
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.configured = /^https?:\/\//.test(url) && !url.includes('YOUR-PROJECT') && key.length > 20;
  }

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL') ?? 'http://localhost:54321';
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? 'missing';
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY') ?? serviceKey;
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    this.adminClient = createClient(url, serviceKey, opts);
    this.authClient = createClient(url, anonKey, opts);
    if (!this.configured) {
      this.logger.warn(
        'Supabase is NOT configured. Set SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in api/.env',
      );
    }
  }

  get admin(): SupabaseClient {
    return this.adminClient;
  }

  get auth(): SupabaseClient {
    return this.authClient;
  }

  async ping(): Promise<boolean> {
    if (!this.configured) return false;
    const { error } = await this.adminClient.from('barangay_services').select('id', { head: true, count: 'exact' });
    return !error;
  }
}
