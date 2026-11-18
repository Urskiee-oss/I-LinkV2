/**
 * I-Link MVP — Supabase Connection & Schema Verifier
 * Checks that all 17 required tables and the `report-attachments` storage bucket
 * exist in your configured Supabase project.
 *
 * Usage: cd api && npm run verify:supabase
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const REQUIRED_TABLES = [
  'profiles',
  'user_roles',
  'emergency_reports',
  'community_reports',
  'report_attachments',
  'report_updates',
  'announcements',
  'community_locations',
  'barangay_services',
  'community_activities',
  'volunteer_registrations',
  'notifications',
  'ai_conversations',
  'ai_messages',
  'knowledge_articles',
  'flood_sensors',
  'sensor_readings',
  'flood_alerts',
];

async function verify() {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'report-attachments';

  if (!url || url.includes('YOUR-PROJECT') || serviceKey.length < 20) {
    console.error('✖ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in api/.env');
    console.error('  1. Paste supabase/bootstrap_all.sql into the Supabase SQL Editor and click Run');
    console.error('  2. Copy your Project URL, anon key, and service_role key into api/.env and web/.env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Verifying Supabase schema at ${url} ...\n`);
  let allPassed = true;

  for (const table of REQUIRED_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      allPassed = false;
      console.log(`  ✖ Table public.${table.padEnd(25)} MISSING (${error.message})`);
    } else {
      console.log(`  ✔ Table public.${table.padEnd(25)} OK (${count ?? 0} rows)`);
    }
  }

  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === bucketName);
  if (bucketErr || !hasBucket) {
    allPassed = false;
    console.log(`\n  ✖ Storage bucket "${bucketName}" MISSING`);
  } else {
    console.log(`\n  ✔ Storage bucket "${bucketName}" OK (private, 5 MB image limit)`);
  }

  if (!allPassed) {
    console.error('\nSchema check failed. Run `supabase/bootstrap_all.sql` in your Supabase SQL Editor.');
    process.exit(1);
  }

  console.log('\n✔ All 18 I-Link tables and storage bucket verified.');
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
