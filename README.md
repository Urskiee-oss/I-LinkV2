# I-Link — AI-Powered Community Intelligence & Resilience Platform (MVP)

**Entry:** 11th Huawei ICT Competition — Innovation Competition  
**University:** Cebu Institute of Technology – University (CIT-U)  
**Team:** Quintet.Dev (Instructor: Roden J. Ugang · Students: Daven Gailien C. Ligan, Christian Emanuelle N. Lariego, Uriel Fyke Guino)

---

## 1. Project Overview & System Concept

**I-Link** is a unified web and mobile-responsive community intelligence and early warning platform designed for Philippine barangays. It connects **Barangay Residents**, **Barangay Officials & Administrators**, and **Emergency Responders / Volunteers** around an end-to-end operational pipeline:

$$\text{Residents} \longrightarrow \text{Community Reports & IoT Telemetry} \longrightarrow \text{AI & Data Processing} \longrightarrow \text{Community Intelligence} \longrightarrow \text{Barangay Response}$$

### Core Subsystems & Modules Implemented

| # | Module | Description |
|---|---|---|
| 1 | **I-Link AI** | Grounded community assistant (`knowledge_base` verified engine + optional Gemini API enhancement) with source citations, verified badges, and deep-linked action suggestions. Never fabricates official announcements. |
| 2 | **I-Link Emergency** | Real-time emergency incident reporting with geolocation/map picker, photo attachment (Supabase Storage), rule-based vulnerability & severity priority scoring, responder dispatch, status stepper (`Submitted → Under Review → Responding → Resolved`), and sub-5-second WebSocket broadcast. |
| 3 | **I-Link Community Map** | Interactive GIS view built with **Leaflet + OpenStreetMap** displaying barangay facilities, evacuation centers, health centers, schools, flood-prone areas, accessibility attributes (`is_accessible`), active public reports, emergency pins (for staff), and live IoT flood sensor nodes. |
| 4 | **I-Link Clean** | Environmental & sanitation reporting (`garbage_accumulation`, `illegal_dumping`, `blocked_drainage`, `sanitation`, `air_pollution`, `water_pollution`) with recurring-hotspot priority boost and a dedicated cleanliness dashboard. |
| 5 | **I-Link Access** | Accessible barangay announcements, pinned urgent advisories, verified publication badges, and persistent national emergency hotlines (`911`, `BFP 160`, `PNP 117`). |
| 6 | **I-Link Bayanihan** | Community participation & volunteer coordination: activity listings, slot limits, resident registration with skills/notes, and organizer participant management (`registered`, `confirmed`, `attended`, `cancelled`). |
| 7 | **I-Link Barangay Services** | Searchable directory of barangay clearances, certificates, permits, requirements, step-by-step procedures, fees, processing times, and office hours, plus administrator CRUD management. |
| 8 | **I-Link Community Intelligence Dashboard** | Live operational analytics computed directly from PostgreSQL records: KPI totals, 14-day incident timeline, status & category distributions, spatiotemporal grid hotspot clustering (~300m cells), 30-day rolling trend deltas, and average resolution time. |
| + | **IoT Flood Early Warning Subsystem** | Emulates the Arduino HC-SR04 ultrasonic sensor + LoRa Python relay described in the I-Link concept: calculates water depth ($\text{sensor\_height} - \text{distance}$) and rise velocity ($\text{cm/min}$), classifies readings into PAGASA/NDRRMC-aligned four-tier alerts (**Advisory / Warning / Danger / Critical**), escalates on rapid rise velocity, and broadcasts real-time WebSocket alerts. |

---

## 2. Technology Stack & Architecture

- **Frontend (`web/`)**: Next.js (App Router) + TypeScript + Tailwind CSS + Leaflet / React-Leaflet + Recharts + Socket.IO Client + Supabase Auth JS Client.
- **Backend (`api/`)**: Node.js + NestJS + REST API (`/api/*`) + NestJS WebSocket Gateway (`/realtime` via Socket.IO) + Class-Validator DTOs + Helmet + Rate Limiting (`@nestjs/throttler`).
- **Database & Services (`supabase/`)**: Supabase PostgreSQL, Supabase Authentication, Supabase Storage (`report-attachments` private bucket with signed URLs), and Row Level Security (RLS) policies.

### Strict Separation of Responsibilities
1. **Browser (`web/`)** uses Supabase **only** for authentication session management (`signInWithPassword`, `getSession`, token refresh). All data reads, writes, file uploads, and real-time events go through the **NestJS backend**.
2. **NestJS (`api/`)** validates every Bearer access token against Supabase Auth, enforces role-based guards (`@Roles('admin', 'responder')`), executes business logic and AI triage scoring, persists changes to Supabase PostgreSQL/Storage, and broadcasts verified real-time events over Socket.IO.
3. **PostgreSQL (`supabase/migrations/`)** enforces referential integrity, check constraints, and defense-in-depth Row Level Security policies.

---

## 3. Repository Structure

```text
i-link/
├── README.md
├── docs/
│   ├── API.md                                   # Complete REST & Socket.IO specification
│   └── contract/types.ts                        # Shared TypeScript interfaces
├── supabase/
│   └── migrations/
│       ├── 20261118000001_schema.sql            # Tables, enums, indexes, auth trigger
│       ├── 20261118000002_rls.sql               # Row Level Security policies
│       └── 20261118000003_storage.sql           # Private report-attachments storage bucket
├── api/                                         # NestJS Backend (port 4000)
│   ├── .env.example
│   ├── scripts/
│   │   ├── seed.ts                              # Seeds demo accounts & Cebu barangay data
│   │   └── flood-simulator.ts                   # Streams simulated ultrasonic sensor telemetry
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── common/                              # Guards, decorators, error filter, triage scorer
│       ├── supabase/                            # SupabaseModule
│       ├── auth/                                # AuthModule
│       ├── users/                               # UsersModule
│       ├── emergency/                           # EmergencyModule
│       ├── reports/                             # ReportsModule + CleanlinessController
│       ├── announcements/                       # AnnouncementsModule (I-Link Access)
│       ├── community-map/                       # CommunityMapModule
│       ├── barangay-services/                   # BarangayServicesModule
│       ├── bayanihan/                           # BayanihanModule
│       ├── notifications/                       # NotificationsModule
│       ├── ai-chat/                             # AiChatModule (I-Link AI)
│       ├── flood/                               # FloodModule + IotController
│       ├── dashboard/                           # DashboardModule (Community Intelligence)
│       └── websockets/                          # WebSocketsModule (Socket.IO Gateway)
└── web/                                         # Next.js Frontend (port 3000)
    ├── .env.example
    └── src/
        ├── app/                                 # Landing, Auth, and /app/* module pages
        ├── components/                          # Reusable UI, AppShell, and Leaflet GIS maps
        └── lib/                                 # API client, Auth context, Realtime Socket.IO
```

---

## 4. Setup & Running Instructions

### Step 1 — Configure Supabase Project & Run SQL Migrations

1. Create a Supabase project at [https://supabase.com](https://supabase.com) (or start local Supabase CLI).
2. Open the **Supabase SQL Editor** and execute the three migration files in order:
   1. `supabase/migrations/20261118000001_schema.sql`
   2. `supabase/migrations/20261118000002_rls.sql`
   3. `supabase/migrations/20261118000003_storage.sql`
3. Copy your project's **Project URL**, **Anon Public Key**, and **Service Role Secret Key** from *Project Settings → API*.

### Step 2 — Configure & Start the NestJS Backend (`api/`)

```bash
cd api
cp .env.example .env
```

Edit `api/.env` and fill in your Supabase credentials:

```env
PORT=4000
CORS_ORIGINS=http://localhost:3000
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=report-attachments

# Optional: leave blank to use the verified knowledge-base engine
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

DEMO_PASSWORD=ILinkDemo2026!
FLOOD_DEVICE_KEY=ilink_demo_kinalumsan_sensor_key_2026
API_URL=http://localhost:4000/api
```

Seed the demo accounts and sample data, then start the API server:

```bash
npm run seed
npm run start:dev
```

The API will listen at `http://localhost:4000/api` and the WebSocket gateway at `ws://localhost:4000/realtime`.

### Step 3 — Configure & Start the Next.js Frontend (`web/`)

```bash
cd ../web
cp .env.example .env.local
```

Edit `web/.env.local` (never put the service role key here):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 5. Demonstration Accounts & Live Competition Walkthrough

After running `cd api && npm run seed`, the following demonstration accounts are ready (and can be autofilled with one click on the `/login` page):

| Role | Email | Password | Capabilities |
|---|---|---|---|
| **Barangay Administrator** | `admin@ilink.demo` | `ILinkDemo2026!` | Full Community Intelligence Dashboard, manage reports, publish announcements, manage GIS map locations, services, Bayanihan activities, flood sensors, and user roles. |
| **BDRRMC Responder** | `responder@ilink.demo` | `ILinkDemo2026!` | Operations dashboard, emergency & community report dispatch queues, status updates, responder notes, live flood monitor. |
| **Barangay Resident** | `resident@ilink.demo` | `ILinkDemo2026!` | Submit emergency & cleanliness reports with map pin & photo, ask I-Link AI, view announcements, browse services, register for Bayanihan activities, track own reports in real time. |

> **Safety Notice:** All seeded records carry `is_demo: true` and render a clear **"Demo data"** badge in the UI so simulated incidents are never confused with real emergencies.

### 10-Step Competition Demo Scenario

1. **Resident Login:** Open Window A at `/login` and click the **Resident Demo Account** button (`resident@ilink.demo`).
2. **View Announcements:** Browse **I-Link Access** (`/app/announcements`) to view the pinned rainy-season flood advisory.
3. **Ask I-Link AI:** Open **I-Link AI** (`/app/ai`) and ask *"What are the requirements for a Barangay Clearance?"* or *"What do the four flood alert tiers mean?"* — observe the verified source chips and action buttons.
4. **Submit Emergency or Cleanliness Report:** Open **Report Emergency** (`/app/emergency/new`) or **I-Link Clean** (`/app/clean`), pick a point on the interactive Cebu barangay map, attach an image, and submit.
5. **Real-Time Staff Alert:** In Window B (logged in as `admin@ilink.demo` or `responder@ilink.demo`), observe the instant Socket.IO toast notification, unread bell counter increment, and computed AI Triage Priority Score + reasons.
6. **Review & Dispatch:** Open the new report in Window B and update its status from `Submitted` → `Under Review` → `Responding` with a dispatch note.
7. **Live Resident Status Stepper:** Watch Window A automatically advance the status stepper and timeline on the resident's report detail view without refreshing the page.
8. **GIS Map & Intelligence Dashboard:** Open `/app/map` and `/app/dashboard` to see the report plotted on the OpenStreetMap layer and reflected in the live database statistics and hotspot clusters.
9. **IoT Flood Early Warning Simulation:** In a terminal, run `cd api && npm run simulate:flood` to stream simulated ultrasonic distance readings and watch `/app/flood` transition across **Advisory → Warning → Danger → Critical** in real time.
