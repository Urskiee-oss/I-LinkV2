# I-Link REST & WebSocket API

Base URL: `http://localhost:4000/api` (configurable via `PORT` / `NEXT_PUBLIC_API_URL`).

- **Auth**: every endpoint except `POST /auth/register`, `GET /health`, and `POST /iot/readings`
  requires `Authorization: Bearer <supabase_access_token>`. The token is the Supabase Auth
  session access token obtained on the frontend with `supabase.auth.signInWithPassword`.
- **Roles**: `resident`, `responder`, `admin`. Enforced by `RolesGuard` in NestJS (and RLS in Postgres).
- **Request bodies**: camelCase JSON (validated by DTOs; unknown fields rejected).
- **Responses**: snake_case JSON rows. Types: [`docs/contract/types.ts`](contract/types.ts).
- **Errors**: `{ statusCode, message, error, path, timestamp }`.
- **Multipart**: report creation accepts `multipart/form-data` with optional `image` (jpeg/png/webp, ≤ 5 MB).

## Health
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ status, supabase: 'ok'|'error', ai_engine, time }` |

## Auth & Users
| Method | Path | Role | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/auth/register` | public | `{ email, password (≥8), fullName, phone?, purok? }` | `{ id, email }` (account created as `resident`, email pre-confirmed) |
| GET | `/auth/me` | any | – | `Me` |
| PATCH | `/users/me` | any | `{ fullName?, phone?, purok?, address? }` | `Profile` |
| GET | `/users` | admin | `?role=&search=` | `UserWithRoles[]` |
| PATCH | `/users/:id` | admin | `{ isActive?, fullName?, phone?, purok? }` | `UserWithRoles` |
| PUT | `/users/:id/role` | admin | `{ role }` | `UserWithRoles` (replaces role) |
| GET | `/users/responders` | admin | – | `PersonRef[]` |

## I-Link Emergency
| Method | Path | Role | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/emergency` | any | multipart: `category, title, description, locationText, latitude?, longitude?, peopleAffected?, image?` | `EmergencyReport` |
| GET | `/emergency/mine` | any | – | `EmergencyReport[]` |
| GET | `/emergency` | admin, responder | `?status=&category=&assigned=me` | `EmergencyReport[]` (with reporter, assignee) |
| GET | `/emergency/map` | admin, responder | – | `MapEmergency[]` |
| GET | `/emergency/:id` | owner, admin, responder | – | `EmergencyReport` + `attachments`, `updates` (internal notes hidden from owner) |
| PATCH | `/emergency/:id/status` | admin, responder | `{ status, note? }` | `EmergencyReport` |
| POST | `/emergency/:id/notes` | admin, responder | `{ note, isInternal? }` | `ReportUpdate` |
| PATCH | `/emergency/:id/assign` | admin | `{ assigneeId: uuid \| null }` | `EmergencyReport` |

## Community reports (general + I-Link Clean)
| Method | Path | Role | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/reports` | any | multipart: `module (clean\|general), category, title, description, locationText, latitude?, longitude?, isPublic?, image?` | `CommunityReport` |
| GET | `/reports/mine` | any | `?module=` | `CommunityReport[]` |
| GET | `/reports/public-map` | any | – | `MapReport[]` (public, unresolved + resolved last 14 days, no reporter identity) |
| GET | `/reports` | admin, responder | `?module=&status=&category=` | `CommunityReport[]` |
| GET | `/reports/:id` | owner, admin, responder | – | `CommunityReport` + `attachments`, `updates` |
| PATCH | `/reports/:id/status` | admin, responder | `{ status, note? }` | `CommunityReport` |
| POST | `/reports/:id/notes` | admin, responder | `{ note, isInternal? }` | `ReportUpdate` |
| PATCH | `/reports/:id/assign` | admin | `{ assigneeId }` | `CommunityReport` |
| GET | `/clean/summary` | any | – | `CleanSummary` |

## I-Link Access — Announcements
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/announcements` | any | `?limit=` | published, unexpired; pinned first |
| GET | `/announcements/manage` | admin | – | all announcements |
| GET | `/announcements/:id` | any | – | `Announcement` |
| POST | `/announcements` | admin | `{ title, summary?, body, category?, priority?, isPinned?, isPublished?, expiresAt? }` | `Announcement` (broadcast `announcement:new` when published) |
| PATCH | `/announcements/:id` | admin | partial of the above | `Announcement` |
| DELETE | `/announcements/:id` | admin | – | `{ success: true }` |

## I-Link Community Map
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/locations` | any | `?category=` | `CommunityLocation[]` (admins also see non-public) |
| POST | `/locations` | admin | `{ name, category, latitude, longitude, description?, address?, contactNumber?, capacity?, isAccessible?, isPublic? }` | `CommunityLocation` |
| PATCH | `/locations/:id` | admin | partial | `CommunityLocation` |
| DELETE | `/locations/:id` | admin | – | `{ success: true }` |

## I-Link Barangay Services
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/services` | any | `?search=` | active services |
| GET | `/services/manage` | admin | – | all services |
| GET | `/services/:id` | any | – | `BarangayService` |
| POST | `/services` | admin | `{ name, category, description, requirements[], procedureSteps[], fee?, processingTime?, office?, officeHours?, contactNumber?, contactEmail?, isActive? }` | `BarangayService` |
| PATCH | `/services/:id` | admin | partial | `BarangayService` |
| DELETE | `/services/:id` | admin | – | `{ success: true }` |

## I-Link Bayanihan
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/activities` | any | `?status=&type=` | `CommunityActivity[]` (with `registered_count`, `my_registration`) |
| GET | `/activities/me/registrations` | any | – | `VolunteerRegistration[]` (with `activity`) |
| GET | `/activities/:id` | any | – | `CommunityActivity` |
| POST | `/activities` | admin | `{ title, description, activityType, isVolunteerOpportunity?, locationText, latitude?, longitude?, startsAt, endsAt?, maxParticipants?, status? }` | `CommunityActivity` |
| PATCH | `/activities/:id` | admin | partial | `CommunityActivity` |
| DELETE | `/activities/:id` | admin | – | `{ success: true }` |
| POST | `/activities/:id/register` | any | `{ skills?, notes? }` | `VolunteerRegistration` (409 if full / already registered) |
| DELETE | `/activities/:id/register` | any | – | `VolunteerRegistration` (status → cancelled) |
| GET | `/activities/:id/participants` | admin | – | `VolunteerRegistration[]` (with `user`) |
| PATCH | `/activities/registrations/:registrationId` | admin | `{ status }` | `VolunteerRegistration` |

## Notifications
| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/notifications` | any | latest 50 `AppNotification[]` |
| GET | `/notifications/unread-count` | any | `{ count }` |
| PATCH | `/notifications/:id/read` | any | `AppNotification` |
| PATCH | `/notifications/read-all` | any | `{ updated }` |

## I-Link AI
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/ai/status` | any | – | `AiStatus` |
| GET | `/ai/conversations` | any | – | `AiConversation[]` |
| GET | `/ai/conversations/:id/messages` | owner | – | `AiMessage[]` |
| POST | `/ai/chat` | any | `{ message (1–1000 chars), conversationId? }` | `AiChatResponse` |
| DELETE | `/ai/conversations/:id` | owner | – | `{ success: true }` |

## Community Intelligence Dashboard
| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/dashboard/stats` | admin, responder | `DashboardStats` |
| GET | `/dashboard/resident` | any | `ResidentDashboard` |

## IoT Flood Early Warning
| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| POST | `/iot/readings` | device (`x-device-key` header) | `{ distanceCm, recordedAt? }` | `{ reading, sensor, alert? }` |
| GET | `/flood/sensors` | any | – | `FloodSensor[]` |
| GET | `/flood/sensors/:id/readings` | any | `?limit=` (≤ 500) | `SensorReading[]` (newest first) |
| GET | `/flood/alerts` | any | `?limit=` | `FloodAlert[]` |
| POST | `/flood/sensors` | admin | `{ name, locationText, latitude, longitude, sensorHeightCm?, advisoryCm?, warningCm?, dangerCm?, criticalCm?, rapidRiseCmMin? }` | `{ sensor, device_key }` (key shown once) |

Tier logic: `depth = sensor_height_cm − distance_cm`; tier from thresholds
(advisory/warning/danger/critical); if rise velocity ≥ `rapid_rise_cm_min` the tier escalates one level.
Tier changes create a `flood_alerts` row, notify all users, and broadcast `flood:alert`.

## WebSocket (Socket.IO)

- URL: `http://localhost:4000/realtime` (namespace `/realtime`, path `/socket.io`).
- Handshake: `io(url, { auth: { token: <supabase_access_token> } })`. Invalid tokens are disconnected.
- Rooms joined automatically: `user:<id>`, `role:<role>`, `staff` (admin/responder), `all`.

| Event | Room | Payload |
|---|---|---|
| `connection:ready` | self | `{ userId, roles }` |
| `notification:new` | `user:<id>` | `AppNotification` (persisted first) |
| `emergency:new` | `staff` | `EmergencyReport` |
| `emergency:updated` | `staff`, reporter | `EmergencyReport` |
| `report:new` | `staff` | `CommunityReport` |
| `report:updated` | `staff`, reporter | `CommunityReport` |
| `announcement:new` | `all` | `Announcement` |
| `activity:updated` | `all` | `{ id, action }` |
| `flood:reading` | `all` | `{ sensor, reading }` |
| `flood:alert` | `all` | `FloodAlert` |
| `dashboard:refresh` | `staff` | `{ reason }` |

All events are emitted **after** the change has been persisted in Supabase.
