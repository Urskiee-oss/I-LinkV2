# I-Link MVP — Supabase Database, Auth & Storage Framework

This directory contains the complete Supabase PostgreSQL, Authentication, Row Level Security (RLS), and Storage framework for **I-Link**.

## 1. Directory Structure

```text
supabase/
├── README.md                                 # This architecture & setup guide
├── config.toml                               # Supabase CLI configuration (`npx supabase start` / `db push`)
├── bootstrap_all.sql                         # All-in-one SQL script (Schema + RLS + Storage + Initial Seed)
├── seed.sql                                  # Declarative SQL seed for services, GIS pins, AI knowledge base, and IoT node
├── migrations/
│   ├── 20261118000001_schema.sql             # 18 tables, 11 enums, indexes, triggers, Auth user signup hook
│   ├── 20261118000002_rls.sql                # Role-based Row Level Security policies (resident / responder / admin)
│   └── 20261118000003_storage.sql            # Private `report-attachments` bucket & storage object policies
└── types/
    └── database.types.ts                     # TypeScript Database interface matching the Postgres schema
```

---

## 2. Three Ways to Provision Supabase

### Option A — One-Shot Paste in Supabase Cloud SQL Editor (Fastest)
1. Create a free Supabase project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor → New Query**.
3. Copy and paste the contents of [`supabase/bootstrap_all.sql`](bootstrap_all.sql) and click **Run**.
   - This creates all 18 tables, 11 enums, triggers, RLS policies, the private `report-attachments` storage bucket, and initial barangay directory/GIS/knowledge-base records in one transaction.
4. Copy your project credentials from **Project Settings → API** into `api/.env` and `web/.env.local`.
5. Verify the schema and seed the 3 demo Auth accounts (`admin@ilink.demo`, `responder@ilink.demo`, `resident@ilink.demo`):
   ```bash
   cd ../api
   npm run verify:supabase
   npm run seed
   ```

### Option B — Step-by-Step Migration Files
Run each file inside [`supabase/migrations/`](migrations/) in numerical order:
1. `20261118000001_schema.sql`
2. `20261118000002_rls.sql`
3. `20261118000003_storage.sql`
4. `seed.sql`

### Option C — Supabase CLI (`npx supabase`)
Because [`supabase/config.toml`](config.toml) is configured, you can push migrations to a linked remote project or run a local Docker stack:
```bash
# Push to remote Supabase project
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# Or run locally with Docker
npx supabase start
npx supabase db reset
```

---

## 3. Entity-Relationship Architecture (18 Tables)

| Domain | Tables | Key Relationships & Automation |
|---|---|---|
| **Identity & RBAC** | `profiles`, `user_roles` | `on_auth_user_created` trigger automatically provisions a `profiles` row and default `resident` role whenever a user signs up in `auth.users`. Helper functions `public.has_role(_role)` and `public.is_staff()` power RLS. |
| **I-Link Emergency** | `emergency_reports`, `report_attachments`, `report_updates` | Auto-generates `EM-XXXXXXXX` reference codes, stores AI priority score (`0–100`) & reasons array, links to reporter & assigned responder. |
| **I-Link Clean & Community Reports** | `community_reports`, `report_attachments`, `report_updates` | Auto-generates `CR-XXXXXXXX` reference codes, separates `module` (`clean` vs `general`), supports public GIS map visibility (`is_public`). |
| **I-Link Access** | `announcements` | Priority-graded (`normal`, `important`, `urgent`), pinned flag, expiration timestamp (`expires_at`). |
| **I-Link Community Map** | `community_locations` | 11 GIS categories (`evacuation_center`, `health_center`, `barangay_hall`, `flood_prone_area`, etc.), capacity, and PWD accessibility flag (`is_accessible`). |
| **I-Link Barangay Services** | `barangay_services` | Requirements array (`text[]`), step-by-step procedures (`text[]`), fee, processing time, and office hours. |
| **I-Link Bayanihan** | `community_activities`, `volunteer_registrations` | Unique `(activity_id, user_id)` constraint, capacity enforcement, attendance status (`registered`, `confirmed`, `attended`, `cancelled`). |
| **I-Link AI** | `ai_conversations`, `ai_messages`, `knowledge_articles` | Persists chat threads, tracks response engine (`knowledge_base` vs `gemini`), and stores verified source citations (`jsonb`). |
| **IoT Flood Early Warning** | `flood_sensors`, `sensor_readings`, `flood_alerts` | Stores SHA-256 hashed device keys (`device_key_hash`), PAGASA/NDRRMC 4-tier thresholds (`advisory_cm`, `warning_cm`, `danger_cm`, `critical_cm`), water depth, and rise velocity ($\text{cm/min}$). |
| **Real-Time Alerts** | `notifications` | Persistent per-user notification inbox synchronized with NestJS Socket.IO rooms. |

---

## 4. Security Model (NestJS + Supabase RLS)

1. **Frontend (`web/`)** holds only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, used strictly for Supabase Auth login/session refresh.
2. **Backend (`api/`)** holds `SUPABASE_SERVICE_ROLE_KEY` in `api/.env` (never exposed to clients). Every request is authenticated by `AuthGuard` (`supabase.auth.getUser(token)`) and authorized by `RolesGuard` before querying Postgres.
3. **Database (`20261118000002_rls.sql`)** enables Row Level Security on all 18 tables plus `storage.objects` in the private `report-attachments` bucket (5 MB limit, `image/jpeg`, `image/png`, `image/webp` only).
