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
-- =====================================================================
-- I-Link MVP — Row Level Security
-- ---------------------------------------------------------------------
-- The NestJS backend is the primary business-logic layer and connects with
-- the service-role key (which bypasses RLS) after performing its own
-- authentication + role checks. These policies are defense-in-depth: if the
-- public anon key is used directly against PostgREST, users can still only
-- reach the rows their role permits.
-- =====================================================================

alter table public.profiles                enable row level security;
alter table public.user_roles              enable row level security;
alter table public.emergency_reports       enable row level security;
alter table public.community_reports       enable row level security;
alter table public.report_attachments      enable row level security;
alter table public.report_updates          enable row level security;
alter table public.announcements           enable row level security;
alter table public.community_locations     enable row level security;
alter table public.barangay_services       enable row level security;
alter table public.community_activities    enable row level security;
alter table public.volunteer_registrations enable row level security;
alter table public.notifications           enable row level security;
alter table public.ai_conversations        enable row level security;
alter table public.ai_messages             enable row level security;
alter table public.knowledge_articles      enable row level security;
alter table public.flood_sensors           enable row level security;
alter table public.sensor_readings         enable row level security;
alter table public.flood_alerts            enable row level security;

-- ---------------- profiles ----------------
create policy "profiles: self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles: staff read"  on public.profiles for select using (public.is_staff());
create policy "profiles: self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin all"   on public.profiles for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- user_roles ----------------
create policy "roles: self read"  on public.user_roles for select using (user_id = auth.uid());
create policy "roles: admin all"  on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- emergency_reports ----------------
create policy "emergency: reporter read"  on public.emergency_reports for select using (reporter_id = auth.uid());
create policy "emergency: staff read"     on public.emergency_reports for select using (public.is_staff());
create policy "emergency: reporter insert" on public.emergency_reports for insert
  with check (reporter_id = auth.uid() and status = 'submitted');
create policy "emergency: staff update"   on public.emergency_reports for update using (public.is_staff()) with check (public.is_staff());
create policy "emergency: admin delete"   on public.emergency_reports for delete using (public.has_role('admin'));

-- ---------------- community_reports ----------------
create policy "community: reporter read" on public.community_reports for select using (reporter_id = auth.uid());
create policy "community: public read"   on public.community_reports for select
  using (auth.role() = 'authenticated' and is_public = true);
create policy "community: staff read"    on public.community_reports for select using (public.is_staff());
create policy "community: reporter insert" on public.community_reports for insert
  with check (reporter_id = auth.uid() and status = 'submitted');
create policy "community: staff update"  on public.community_reports for update using (public.is_staff()) with check (public.is_staff());
create policy "community: admin delete"  on public.community_reports for delete using (public.has_role('admin'));

-- ---------------- report_attachments ----------------
create policy "attachments: owner read" on public.report_attachments for select using (uploaded_by = auth.uid());
create policy "attachments: staff read" on public.report_attachments for select using (public.is_staff());
create policy "attachments: owner insert" on public.report_attachments for insert with check (uploaded_by = auth.uid());

-- ---------------- report_updates ----------------
create policy "updates: staff all" on public.report_updates for all using (public.is_staff()) with check (public.is_staff());
create policy "updates: reporter read public" on public.report_updates for select using (
  is_internal = false and (
    exists (select 1 from public.emergency_reports e where e.id = emergency_report_id and e.reporter_id = auth.uid())
    or exists (select 1 from public.community_reports c where c.id = community_report_id and c.reporter_id = auth.uid())
  )
);

-- ---------------- announcements ----------------
create policy "announcements: read published" on public.announcements for select
  using (is_published = true and (expires_at is null or expires_at > now()));
create policy "announcements: admin all" on public.announcements for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- community_locations ----------------
create policy "locations: read public" on public.community_locations for select using (is_public = true);
create policy "locations: staff read"  on public.community_locations for select using (public.is_staff());
create policy "locations: admin all"   on public.community_locations for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- barangay_services ----------------
create policy "services: read active" on public.barangay_services for select using (is_active = true);
create policy "services: admin all"   on public.barangay_services for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- community_activities ----------------
create policy "activities: read" on public.community_activities for select using (auth.role() = 'authenticated');
create policy "activities: admin all" on public.community_activities for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- volunteer_registrations ----------------
create policy "volunteers: self read"   on public.volunteer_registrations for select using (user_id = auth.uid());
create policy "volunteers: self insert" on public.volunteer_registrations for insert with check (user_id = auth.uid());
create policy "volunteers: self update" on public.volunteer_registrations for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "volunteers: admin all"   on public.volunteer_registrations for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- notifications ----------------
create policy "notifications: self read"   on public.notifications for select using (user_id = auth.uid());
create policy "notifications: self update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- AI ----------------
create policy "ai conversations: self all" on public.ai_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai messages: self read" on public.ai_messages for select using (
  exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create policy "knowledge: read active" on public.knowledge_articles for select using (is_active = true);
create policy "knowledge: admin all"   on public.knowledge_articles for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------- Flood monitoring ----------------
-- Sensor rows contain device_key_hash: only staff may read the raw table.
-- Residents receive sanitized sensor status through the NestJS API.
create policy "sensors: staff read" on public.flood_sensors for select using (public.is_staff());
create policy "sensors: admin all"  on public.flood_sensors for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "readings: authenticated read" on public.sensor_readings for select using (auth.role() = 'authenticated');
create policy "flood alerts: authenticated read" on public.flood_alerts for select using (auth.role() = 'authenticated');
-- =====================================================================
-- I-Link MVP — Supabase Storage
-- Private bucket for report images. Files are uploaded by the NestJS backend
-- (service role) after validation; clients receive short-lived signed URLs.
-- Path convention: {user_id}/{report_type}/{report_id}/{uuid}.{ext}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-attachments', 'report-attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Defense in depth for direct (anon-key) access
create policy "report files: owner read" on storage.objects for select
  using (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report files: staff read" on storage.objects for select
  using (bucket_id = 'report-attachments' and public.is_staff());

create policy "report files: owner upload" on storage.objects for insert
  with check (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
-- =====================================================================
-- I-Link MVP — Declarative SQL Seed (Public Directory, GIS, Knowledge Base, IoT)
-- Can be run directly in the Supabase SQL Editor after migrations or
-- automatically by `npx supabase db reset`.
-- (For Auth demo accounts admin/responder/resident@ilink.demo, run `cd api && npm run seed`.)
-- =====================================================================

-- 1. Barangay Services Directory (I-Link Barangay Services)
insert into public.barangay_services
  (name, category, description, requirements, procedure_steps, fee, processing_time, office, office_hours, contact_number, contact_email, is_active)
values
  (
    'Barangay Clearance',
    'certificate',
    'Official certification confirming good moral standing and residency in the barangay for employment, business, or ID applications.',
    array[
      'Valid government-issued ID or school ID',
      'Community Tax Certificate (Cedula) for the current year',
      'Purok Clearance or Certificate of Residency signed by Purok Leader'
    ],
    array[
      'Present requirements at Window 1 (Records & Verification Desk).',
      'Pay the corresponding clearance fee at Window 2 (Barangay Treasurer).',
      'Have your photo and signature captured at Window 3.',
      'Claim the signed and dry-sealed Barangay Clearance (15–20 minutes).'
    ],
    'PHP 50.00 (Free for first-time jobseekers under RA 11261)',
    '15–20 minutes',
    'Barangay Hall — Ground Floor, Records Section',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4401',
    'records@barangay-ilink.gov.ph',
    true
  ),
  (
    'Certificate of Indigency',
    'certificate',
    'Issued to qualified low-income residents seeking medical, educational, burial, or legal assistance from DSWD, PCSO, or scholarship programs.',
    array[
      'Valid ID or voter certification of applicant or immediate family member',
      'Brief written request or hospital bill / scholarship endorsement',
      'Purok Leader attestation of household status'
    ],
    array[
      'Submit requirements at the Social Services Desk (Window 1).',
      'Undergo brief verification interview with the Barangay Social Worker.',
      'Receive signed Certificate of Indigency from the Punong Barangay office.'
    ],
    'Free (PHP 0.00)',
    '15 minutes',
    'Barangay Hall — Social Services Desk',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4402',
    'socialservices@barangay-ilink.gov.ph',
    true
  ),
  (
    'Barangay Business Permit Clearance',
    'permit',
    'Mandatory barangay endorsement required for new business registration or annual renewal with the City Business Permits and Licensing Office (BPLO).',
    array[
      'DTI Business Name Registration (sole proprietorship) or SEC Registration',
      'Contract of Lease or Transfer Certificate of Title for business address',
      'Previous year Barangay Business Clearance (for renewals)'
    ],
    array[
      'Submit documents at Window 2 (Business & Treasury Section).',
      'Pay barangay business clearance fee based on business classification.',
      'Release of signed Barangay Business Clearance with official receipt.'
    ],
    'PHP 200.00 – PHP 1,000.00 (based on capital classification)',
    '30 minutes',
    'Barangay Hall — Treasury & Licensing Section',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4403',
    'treasury@barangay-ilink.gov.ph',
    true
  ),
  (
    'Katarungang Pambarangay (Lupong Tagapamayapa) Mediation',
    'legal',
    'Community dispute resolution and mediation service prior to court filing in accordance with the Local Government Code (RA 7160).',
    array[
      'Valid ID of complainant',
      'Complete name and address of respondent within the barangay',
      'Written narrative of complaint and relief sought'
    ],
    array[
      'File complaint form at the Lupong Tagapamayapa Desk.',
      'Receive scheduled summons date for Punong Barangay mediation.',
      'Attend mediation/conciliation conferences as scheduled.'
    ],
    'Free (PHP 0.00)',
    '1–3 scheduled mediation hearings',
    'Barangay Hall — 2nd Floor, Lupon Session Room',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4404',
    'lupon@barangay-ilink.gov.ph',
    true
  )
on conflict (name) do update set
  description = excluded.description,
  requirements = excluded.requirements,
  procedure_steps = excluded.procedure_steps,
  fee = excluded.fee,
  processing_time = excluded.processing_time,
  office = excluded.office,
  office_hours = excluded.office_hours,
  contact_number = excluded.contact_number,
  contact_email = excluded.contact_email,
  is_active = excluded.is_active;

-- 2. Verified Knowledge Base Articles (I-Link AI)
delete from public.knowledge_articles where source in (
  'BDRRMC Flood Protocol (Verified)',
  'I-Link Platform Guide (Verified)',
  'Barangay Emergency Directory (Verified)'
);

insert into public.knowledge_articles (topic, question, answer, keywords, source, is_active)
values
  (
    'emergency_procedure',
    'What do the four I-Link Flood Alert Tiers (Advisory, Warning, Danger, Critical) mean?',
    E'I-Link uses an ultrasonic IoT sensor measuring water depth and rise velocity (cm/min) every 10 seconds, aligned with PAGASA and NDRRMC protocols:\n• Advisory (Yellow, ≥50 cm): Monitor water levels and prepare household supplies.\n• Warning (Orange, ≥100 cm): Pack go-bags and prepare senior citizens, children, and PWDs.\n• Danger (Red, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to designated evacuation centers.\n• Critical (Dark Red, ≥200 cm): Immediate mandatory evacuation; call 911 or BDRRMC responders.',
    array['flood', 'tier', 'advisory', 'warning', 'danger', 'critical', 'pagasa', 'sensor', 'water'],
    'BDRRMC Flood Protocol (Verified)',
    true
  ),
  (
    'faq',
    'How do I submit an emergency or community cleanliness report on I-Link?',
    E'1. For immediate hazards (fire, flood, medical, accident), open "I-Link Emergency", choose a category, describe the situation, click the map or "Use my location" to geotag, optionally attach a photo, and submit. BDRRMC responders receive a sub-5-second real-time alert.\n2. For garbage, clogged canals, or sanitation issues, open "I-Link Clean".\n3. You can track status transitions (Submitted → Under Review → Responding → Resolved) in "My Reports".',
    array['report', 'submit', 'emergency', 'clean', 'garbage', 'status', 'track'],
    'I-Link Platform Guide (Verified)',
    true
  ),
  (
    'emergency_procedure',
    'What are the emergency hotlines and evacuation centers in our barangay?',
    'National Emergency Hotline: 911 | Bureau of Fire Protection (BFP): 160 | Philippine National Police (PNP): 117 | Barangay BDRRMC Desk: (032) 261-4401. Our primary evacuation center is Labangon Community Evacuation Gymnasium (Katipunan St., capacity 450, PWD-accessible).',
    array['hotline', '911', 'evacuation', 'phone', 'contact', 'fire', 'police', 'rescue'],
    'Barangay Emergency Directory (Verified)',
    true
  );

-- 3. Community GIS Locations (I-Link Community Map)
delete from public.community_locations where is_demo = true;

insert into public.community_locations
  (name, category, description, address, latitude, longitude, contact_number, capacity, is_accessible, is_public, is_demo)
values
  (
    'Barangay Command & Administrative Hall (Demo)',
    'barangay_hall',
    '24/7 BDRRMC operations desk, barangay clearances, and Lupon office.',
    'N. Bacalso Ave., Cebu City',
    10.2948, 123.8814, '(032) 261-4401', 120, true, true, true
  ),
  (
    'Labangon Community Evacuation Gymnasium (Demo)',
    'evacuation_center',
    'Primary flood and typhoon evacuation center with generator backup, water station, and PWD accessibility ramp.',
    'Katipunan St., Cebu City',
    10.2974, 123.8832, '(032) 261-4490', 450, true, true, true
  ),
  (
    'Barangay Primary Health & Birthing Center (Demo)',
    'health_center',
    'First-aid triage, maternal care, immunization, and emergency stabilization.',
    'Tres de Abril St., Cebu City',
    10.2959, 123.8798, '(032) 261-4412', 60, true, true, true
  ),
  (
    'Cebu Institute of Technology – University Campus Assembly Point (Demo)',
    'school',
    'Partner academic institution and secondary emergency assembly zone.',
    'N. Bacalso Ave., Cebu City',
    10.2945, 123.8811, '(032) 261-7741', 800, true, true, true
  ),
  (
    'Kinalumsan Creek Low-Lying Flood Hazard Zone (Demo)',
    'flood_prone_area',
    'Historical flash-flood zone monitored by Ultrasonic IoT Node #1. Pre-emptive evacuation triggered at Danger tier.',
    'Purok 3 Sitio Riverside, Cebu City',
    10.2932, 123.8842, '(032) 261-4401', null, false, true, true
  );

-- 4. Official Announcements (I-Link Access)
delete from public.announcements where is_demo = true;

insert into public.announcements
  (title, summary, body, category, priority, is_published, is_pinned, is_demo)
values
  (
    '[DEMO] Rainy Season Flood Preparedness & Four-Tier Early Warning Activation',
    'Our IoT ultrasonic flood sensor at Kinalumsan River Bridge is active. Review the PAGASA-aligned Advisory, Warning, Danger, and Critical alert thresholds.',
    E'The Barangay Disaster Risk Reduction and Management Committee (BDRRMC) reminds all residents—especially households in Purok 2 and Purok 3 Riverside—that the I-Link IoT Flood Early Warning Node at Kinalumsan Bridge is transmitting live telemetry every 10 seconds.\n\nTiered Alert Actions:\n• YELLOW (Advisory, ≥50 cm): Monitor I-Link alerts and secure ground-floor valuables.\n• ORANGE (Warning, ≥100 cm): Prepare emergency go-bags, medicines, and documents; assist senior citizens and PWDs.\n• RED (Danger, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to Labangon Elementary School Gymnasium.\n• DARK RED (Critical, ≥200 cm): Mandatory evacuation in progress; contact BDRRMC Rescue or call 911 immediately.',
    'disaster_preparedness', 'urgent', true, true, true
  ),
  (
    '[DEMO] Saturday Bayanihan Canal Declogging & Solid Waste Segregation Drive',
    'Join volunteers this Saturday at 6:30 AM at Purok 3 Sitio Riverside to clear drainage waterways identified by I-Link Clean hotspot analytics.',
    E'I-Link Clean spatial clustering identified recurring drainage blockages along Katipunan Extension and Purok 3 creekside. The Barangay Environment Committee invites residents, SK youth, and student volunteers to register via I-Link Bayanihan.\n\nGloves, sacks, and refreshments will be provided at the assembly point in front of the Barangay Covered Court.',
    'environment', 'important', true, false, true
  );

-- 5. IoT Flood Sensor Node #1 (device key: ilink_demo_kinalumsan_sensor_key_2026)
insert into public.flood_sensors
  (name, location_text, latitude, longitude, device_key_hash, sensor_height_cm, advisory_cm, warning_cm, danger_cm, critical_cm, rapid_rise_cm_min, current_tier, last_depth_cm, last_rise_cm_min, last_reading_at, is_active, is_demo)
values
  (
    'Node #1 — Kinalumsan River Bridge (Demo IoT)',
    'Purok 3 Sitio Riverside Footbridge, Cebu City',
    10.2932, 123.8842,
    encode(digest('ilink_demo_kinalumsan_sensor_key_2026', 'sha256'), 'hex'),
    400, 50, 100, 150, 200, 2.0,
    'advisory', 62, 1.2, now(), true, true
  )
on conflict (device_key_hash) do nothing;
