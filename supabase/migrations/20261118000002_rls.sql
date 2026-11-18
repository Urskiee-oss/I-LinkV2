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
