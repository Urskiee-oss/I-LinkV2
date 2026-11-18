-- =====================================================================
-- I-Link MVP — Core schema
-- AI-Powered Community Intelligence & Resilience Platform
-- =====================================================================
-- Run order: 0001_schema.sql -> 0002_rls.sql -> 0003_storage.sql -> seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('resident', 'admin', 'responder');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('submitted', 'under_review', 'responding', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_priority as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.emergency_category as enum (
    'fire', 'flood', 'medical', 'crime', 'accident', 'earthquake',
    'landslide', 'power_outage', 'missing_person', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Community reports cover I-Link Clean (environmental) and general concerns
  create type public.community_category as enum (
    'garbage_accumulation', 'illegal_dumping', 'blocked_drainage', 'sanitation',
    'air_pollution', 'water_pollution', 'noise', 'stray_animals',
    'road_damage', 'streetlight', 'accessibility_obstacle', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_module as enum ('clean', 'general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.location_category as enum (
    'barangay_hall', 'health_center', 'evacuation_center', 'school',
    'police_station', 'fire_station', 'hospital', 'flood_prone_area',
    'accessible_facility', 'public_facility', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.announcement_priority as enum ('normal', 'important', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum (
    'community_program', 'environmental', 'disaster_response',
    'volunteer_program', 'community_project', 'donation_drive'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_status as enum ('upcoming', 'ongoing', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.registration_status as enum ('registered', 'confirmed', 'attended', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.flood_tier as enum ('normal', 'advisory', 'warning', 'danger', 'critical');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null check (char_length(full_name) between 2 and 120),
  email        text not null,
  phone        text,
  purok        text,             -- zone / sitio within the barangay
  address      text,
  avatar_url   text,
  is_active    boolean not null default true,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);
create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();

-- Role helper used by RLS policies (security definer avoids recursive RLS)
create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = _role
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin', 'responder')
  );
$$;

-- Auto-create profile + resident role for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, purok)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'purok'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'resident')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- emergency_reports (I-Link Emergency)
-- ---------------------------------------------------------------------
create table if not exists public.emergency_reports (
  id              uuid primary key default gen_random_uuid(),
  reference_code  text not null unique default ('EM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  category        public.emergency_category not null,
  title           text not null check (char_length(title) between 4 and 140),
  description     text not null check (char_length(description) between 10 and 4000),
  location_text   text not null check (char_length(location_text) between 3 and 300),
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  people_affected integer check (people_affected >= 0),
  status          public.report_status not null default 'submitted',
  priority        public.report_priority not null default 'high',
  priority_score  integer not null default 0 check (priority_score between 0 and 100),
  priority_reasons text[] not null default '{}',
  assigned_to     uuid references public.profiles (id) on delete set null,
  is_demo         boolean not null default false,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists emergency_reports_reporter_idx on public.emergency_reports (reporter_id);
create index if not exists emergency_reports_status_idx   on public.emergency_reports (status);
create index if not exists emergency_reports_created_idx  on public.emergency_reports (created_at desc);
create index if not exists emergency_reports_assigned_idx on public.emergency_reports (assigned_to);
create trigger emergency_reports_updated_at before update on public.emergency_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- community_reports (I-Link Clean + general community concerns)
-- ---------------------------------------------------------------------
create table if not exists public.community_reports (
  id              uuid primary key default gen_random_uuid(),
  reference_code  text not null unique default ('CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  module          public.report_module not null default 'general',
  category        public.community_category not null,
  title           text not null check (char_length(title) between 4 and 140),
  description     text not null check (char_length(description) between 10 and 4000),
  location_text   text not null check (char_length(location_text) between 3 and 300),
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  status          public.report_status not null default 'submitted',
  priority        public.report_priority not null default 'medium',
  priority_score  integer not null default 0 check (priority_score between 0 and 100),
  priority_reasons text[] not null default '{}',
  is_public       boolean not null default true,   -- may appear on community map
  assigned_to     uuid references public.profiles (id) on delete set null,
  is_demo         boolean not null default false,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists community_reports_reporter_idx on public.community_reports (reporter_id);
create index if not exists community_reports_status_idx   on public.community_reports (status);
create index if not exists community_reports_module_idx   on public.community_reports (module);
create index if not exists community_reports_created_idx  on public.community_reports (created_at desc);
create trigger community_reports_updated_at before update on public.community_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- report_attachments (exactly one parent report)
-- ---------------------------------------------------------------------
create table if not exists public.report_attachments (
  id                   uuid primary key default gen_random_uuid(),
  emergency_report_id  uuid references public.emergency_reports (id) on delete cascade,
  community_report_id  uuid references public.community_reports (id) on delete cascade,
  uploaded_by          uuid not null references public.profiles (id) on delete cascade,
  storage_path         text not null unique,
  file_name            text not null,
  mime_type            text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes           integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint report_attachments_one_parent check (
    (emergency_report_id is not null)::int + (community_report_id is not null)::int = 1
  )
);
create index if not exists report_attachments_em_idx on public.report_attachments (emergency_report_id);
create index if not exists report_attachments_cr_idx on public.report_attachments (community_report_id);
create trigger report_attachments_updated_at before update on public.report_attachments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- report_updates (status history + responder notes, both report types)
-- ---------------------------------------------------------------------
create table if not exists public.report_updates (
  id                   uuid primary key default gen_random_uuid(),
  emergency_report_id  uuid references public.emergency_reports (id) on delete cascade,
  community_report_id  uuid references public.community_reports (id) on delete cascade,
  author_id            uuid not null references public.profiles (id) on delete cascade,
  from_status          public.report_status,
  to_status            public.report_status,
  note                 text check (note is null or char_length(note) <= 2000),
  is_internal          boolean not null default false, -- internal notes hidden from residents
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint report_updates_one_parent check (
    (emergency_report_id is not null)::int + (community_report_id is not null)::int = 1
  )
);
create index if not exists report_updates_em_idx on public.report_updates (emergency_report_id, created_at);
create index if not exists report_updates_cr_idx on public.report_updates (community_report_id, created_at);
create trigger report_updates_updated_at before update on public.report_updates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- announcements (I-Link Access)
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles (id) on delete set null,
  title         text not null check (char_length(title) between 4 and 160),
  summary       text check (summary is null or char_length(summary) <= 300),
  body          text not null check (char_length(body) between 10 and 10000),
  category      text not null default 'general',
  priority      public.announcement_priority not null default 'normal',
  is_published  boolean not null default true,
  is_pinned     boolean not null default false,
  published_at  timestamptz not null default now(),
  expires_at    timestamptz,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists announcements_published_idx on public.announcements (is_published, published_at desc);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- community_locations (I-Link Community Map)
-- ---------------------------------------------------------------------
create table if not exists public.community_locations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 160),
  category       public.location_category not null,
  description    text,
  address        text,
  latitude       double precision not null check (latitude between -90 and 90),
  longitude      double precision not null check (longitude between -180 and 180),
  contact_number text,
  capacity       integer check (capacity >= 0),
  is_accessible  boolean not null default false,   -- wheelchair / PWD accessible
  is_public      boolean not null default true,
  created_by     uuid references public.profiles (id) on delete set null,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists community_locations_category_idx on public.community_locations (category);
create trigger community_locations_updated_at before update on public.community_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- barangay_services (I-Link Barangay Services)
-- ---------------------------------------------------------------------
create table if not exists public.barangay_services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique check (char_length(name) between 3 and 160),
  category         text not null default 'certificate',
  description      text not null,
  requirements     text[] not null default '{}',
  procedure_steps  text[] not null default '{}',
  fee              text,
  processing_time  text,
  office           text,
  office_hours     text,
  contact_number   text,
  contact_email    text,
  is_active        boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists barangay_services_active_idx on public.barangay_services (is_active);
create trigger barangay_services_updated_at before update on public.barangay_services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- community_activities (I-Link Bayanihan)
-- ---------------------------------------------------------------------
create table if not exists public.community_activities (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) between 4 and 160),
  description       text not null,
  activity_type     public.activity_type not null default 'community_program',
  is_volunteer_opportunity boolean not null default true,
  location_text     text not null,
  latitude          double precision,
  longitude         double precision,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  max_participants  integer check (max_participants is null or max_participants > 0),
  status            public.activity_status not null default 'upcoming',
  organizer_id      uuid references public.profiles (id) on delete set null,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint activity_time_order check (ends_at is null or ends_at >= starts_at)
);
create index if not exists community_activities_starts_idx on public.community_activities (starts_at);
create index if not exists community_activities_status_idx on public.community_activities (status);
create trigger community_activities_updated_at before update on public.community_activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- volunteer_registrations
-- ---------------------------------------------------------------------
create table if not exists public.volunteer_registrations (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.community_activities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       public.registration_status not null default 'registered',
  skills       text,
  notes        text check (notes is null or char_length(notes) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id, user_id)
);
create index if not exists volunteer_registrations_user_idx on public.volunteer_registrations (user_id);
create index if not exists volunteer_registrations_activity_idx on public.volunteer_registrations (activity_id);
create trigger volunteer_registrations_updated_at before update on public.volunteer_registrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,          -- emergency_new | report_status | announcement | activity | flood_alert
  title       text not null,
  body        text not null,
  link        text,
  data        jsonb not null default '{}'::jsonb,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ai_conversations / ai_messages (I-Link AI)
-- ---------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null check (char_length(content) <= 8000),
  engine           text check (engine in ('knowledge_base', 'gemini')),  -- who produced an assistant reply
  sources          jsonb not null default '[]'::jsonb,                   -- verified records cited
  suggested_actions jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create trigger ai_messages_updated_at before update on public.ai_messages
  for each row execute function public.set_updated_at();

-- Verified knowledge (FAQ / emergency procedures) curated by admins
create table if not exists public.knowledge_articles (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,                 -- faq | emergency_procedure | platform_help
  question    text not null,
  answer      text not null,
  keywords    text[] not null default '{}',
  source      text not null default 'Barangay Office (verified)',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger knowledge_articles_updated_at before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- IoT Flood Early Warning (from the I-Link concept: ultrasonic sensor,
-- rise velocity, four-tier PAGASA/NDRRMC-style alerts)
-- ---------------------------------------------------------------------
create table if not exists public.flood_sensors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  location_text       text not null,
  latitude            double precision not null,
  longitude           double precision not null,
  device_key_hash     text not null unique,            -- sha256 of the device API key
  sensor_height_cm    numeric(7,2) not null default 400, -- distance from sensor to riverbed
  advisory_cm         numeric(7,2) not null default 50,
  warning_cm          numeric(7,2) not null default 100,
  danger_cm           numeric(7,2) not null default 150,
  critical_cm         numeric(7,2) not null default 200,
  rapid_rise_cm_min   numeric(7,2) not null default 2,   -- escalates one tier when exceeded
  current_tier        public.flood_tier not null default 'normal',
  last_depth_cm       numeric(7,2),
  last_rise_cm_min    numeric(7,2),
  last_reading_at     timestamptz,
  is_active           boolean not null default true,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint flood_thresholds_order check (advisory_cm < warning_cm and warning_cm < danger_cm and danger_cm < critical_cm)
);
create trigger flood_sensors_updated_at before update on public.flood_sensors
  for each row execute function public.set_updated_at();

create table if not exists public.sensor_readings (
  id            bigint generated always as identity primary key,
  sensor_id     uuid not null references public.flood_sensors (id) on delete cascade,
  distance_cm   numeric(7,2) not null,
  depth_cm      numeric(7,2) not null,
  rise_cm_min   numeric(7,2),
  tier          public.flood_tier not null,
  recorded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists sensor_readings_sensor_idx on public.sensor_readings (sensor_id, recorded_at desc);

create table if not exists public.flood_alerts (
  id            uuid primary key default gen_random_uuid(),
  sensor_id     uuid not null references public.flood_sensors (id) on delete cascade,
  tier          public.flood_tier not null,
  previous_tier public.flood_tier not null,
  depth_cm      numeric(7,2) not null,
  rise_cm_min   numeric(7,2),
  message       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists flood_alerts_created_idx on public.flood_alerts (created_at desc);
create trigger flood_alerts_updated_at before update on public.flood_alerts
  for each row execute function public.set_updated_at();
