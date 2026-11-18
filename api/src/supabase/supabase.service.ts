import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocalStore } from './local-store';

/**
 * Centralized Supabase access for the backend.
 *
 * - When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured in `api/.env`,
 *   this service connects to your live Supabase PostgreSQL, Auth, and Storage project.
 * - When those env vars are not yet set, it automatically falls back to `LocalStore`
 *   (backed by `api/.local-db.json` and pre-seeded with the full Cebu Barangay demo dataset)
 *   so the entire MVP works out of the box and switches seamlessly once Supabase keys are added.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient!: SupabaseClient;
  private authClient!: SupabaseClient;
  private cloudAuthClient: SupabaseClient | null = null;
  private localStore!: LocalStore;
  readonly bucket: string;
  readonly configured: boolean;
  readonly isCloud: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'report-attachments';
    const url = this.config.get<string>('SUPABASE_URL') ?? '';
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.isCloud = /^https?:\/\//.test(url) && !url.includes('YOUR-PROJECT') && key.length > 20;
    // Configured is always true (either Cloud Supabase or Built-in Local Compatibility Store)
    this.configured = true;
  }

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL') ?? '';
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY') ?? '';
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    if (/^https?:\/\//.test(url) && !url.includes('YOUR-PROJECT') && anonKey.length > 20) {
      this.cloudAuthClient = createClient(url, anonKey, opts);
    }

    if (this.isCloud) {
      const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;
      this.adminClient = createClient(url, serviceKey, opts);
      this.authClient = this.cloudAuthClient ?? createClient(url, serviceKey, opts);
      this.logger.log(`Connected to Supabase project: ${url}`);
    } else {
      this.localStore = new LocalStore();
      this.adminClient = this.localStore as unknown as SupabaseClient;
      this.authClient = this.localStore as unknown as SupabaseClient;
      this.logger.log(
        'Running with built-in Local Supabase Compatibility Store (api/.local-db.json) + Cloud Auth token verification. Add SUPABASE_SERVICE_ROLE_KEY in api/.env for direct Cloud admin writes.',
      );
    }
  }

  get cloudAuth(): SupabaseClient | null {
    return this.cloudAuthClient;
  }

  get admin(): SupabaseClient {
    return this.adminClient;
  }

  get auth(): SupabaseClient {
    return this.authClient;
  }

  get local(): LocalStore | null {
    return this.isCloud ? null : this.localStore;
  }

  async ping(): Promise<boolean> {
    const { error } = await this.adminClient
      .from('barangay_services')
      .select('id', { head: true, count: 'exact' });
    return !error;
  }
}
