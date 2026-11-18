/**
 * I-Link shared API contract types.
 * Responses from the NestJS API use snake_case (raw DB column names).
 * Request bodies use camelCase (validated by NestJS DTOs).
 */

export type AppRole = 'resident' | 'admin' | 'responder';
export type ReportStatus = 'submitted' | 'under_review' | 'responding' | 'resolved';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportModule = 'clean' | 'general';
export type FloodTier = 'normal' | 'advisory' | 'warning' | 'danger' | 'critical';

export const EMERGENCY_CATEGORIES = [
  'fire', 'flood', 'medical', 'crime', 'accident', 'earthquake',
  'landslide', 'power_outage', 'missing_person', 'other',
] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export const CLEAN_CATEGORIES = [
  'garbage_accumulation', 'illegal_dumping', 'blocked_drainage', 'sanitation',
  'air_pollution', 'water_pollution',
] as const;
export const GENERAL_CATEGORIES = [
  'noise', 'stray_animals', 'road_damage', 'streetlight', 'accessibility_obstacle', 'other',
] as const;
export type CommunityCategory =
  | (typeof CLEAN_CATEGORIES)[number]
  | (typeof GENERAL_CATEGORIES)[number];

export const LOCATION_CATEGORIES = [
  'barangay_hall', 'health_center', 'evacuation_center', 'school', 'police_station',
  'fire_station', 'hospital', 'flood_prone_area', 'accessible_facility', 'public_facility', 'other',
] as const;
export type LocationCategory = (typeof LOCATION_CATEGORIES)[number];

export const ACTIVITY_TYPES = [
  'community_program', 'environmental', 'disaster_response',
  'volunteer_program', 'community_project', 'donation_drive',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ActivityStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type RegistrationStatus = 'registered' | 'confirmed' | 'attended' | 'cancelled';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  purok: string | null;
  address: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/** GET /auth/me */
export interface Me {
  id: string;
  email: string;
  roles: AppRole[];
  primary_role: AppRole; // admin > responder > resident
  profile: Profile;
}

/** GET /users (admin) */
export interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export interface PersonRef {
  id: string;
  full_name: string;
  email?: string;
  phone?: string | null;
  purok?: string | null;
}

export interface Attachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null; // short-lived signed URL
}

export interface ReportUpdate {
  id: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus | null;
  note: string | null;
  is_internal: boolean;
  created_at: string;
  author: PersonRef | null;
}

interface ReportBase {
  id: string;
  reference_code: string;
  reporter_id: string;
  title: string;
  description: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  priority: ReportPriority;
  priority_score: number;
  priority_reasons: string[];
  assigned_to: string | null;
  is_demo: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reporter?: PersonRef | null;
  assignee?: PersonRef | null;
  attachments?: Attachment[]; // included on detail endpoints
  updates?: ReportUpdate[]; // included on detail endpoints
  attachment_count?: number; // included on list endpoints
}

export interface EmergencyReport extends ReportBase {
  category: EmergencyCategory;
  people_affected: number | null;
}

export interface CommunityReport extends ReportBase {
  module: ReportModule;
  category: CommunityCategory;
  is_public: boolean;
}

/** GET /reports/public-map — sanitized, no reporter identity */
export interface MapReport {
  id: string;
  reference_code: string;
  kind: 'community';
  module: ReportModule;
  category: CommunityCategory;
  title: string;
  status: ReportStatus;
  priority: ReportPriority;
  latitude: number;
  longitude: number;
  created_at: string;
}

/** GET /emergency/map (staff only) */
export interface MapEmergency {
  id: string;
  reference_code: string;
  kind: 'emergency';
  category: EmergencyCategory;
  title: string;
  status: ReportStatus;
  priority: ReportPriority;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Announcement {
  id: string;
  author_id: string | null;
  title: string;
  summary: string | null;
  body: string;
  category: string;
  priority: AnnouncementPriority;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  author?: PersonRef | null;
}

export interface CommunityLocation {
  id: string;
  name: string;
  category: LocationCategory;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  contact_number: string | null;
  capacity: number | null;
  is_accessible: boolean;
  is_public: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BarangayService {
  id: string;
  name: string;
  category: string;
  description: string;
  requirements: string[];
  procedure_steps: string[];
  fee: string | null;
  processing_time: string | null;
  office: string | null;
  office_hours: string | null;
  contact_number: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityActivity {
  id: string;
  title: string;
  description: string;
  activity_type: ActivityType;
  is_volunteer_opportunity: boolean;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  ends_at: string | null;
  max_participants: number | null;
  status: ActivityStatus;
  organizer_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  registered_count: number; // active (non-cancelled) registrations
  my_registration: VolunteerRegistration | null; // for the current user
  organizer?: PersonRef | null;
}

export interface VolunteerRegistration {
  id: string;
  activity_id: string;
  user_id: string;
  status: RegistrationStatus;
  skills: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: PersonRef; // on participants endpoint
  activity?: Pick<CommunityActivity, 'id' | 'title' | 'starts_at' | 'location_text' | 'status'>; // on /activities/me/registrations
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'emergency_new' | 'report_new' | 'report_status' | 'announcement' | 'activity' | 'flood_alert' | string;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AiSource {
  type: 'knowledge_article' | 'barangay_service' | 'announcement' | 'community_location';
  id: string;
  title: string;
  verified: boolean;
}

export interface AiSuggestedAction {
  label: string;
  href: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  engine: 'knowledge_base' | 'gemini' | null;
  sources: AiSource[];
  suggested_actions: AiSuggestedAction[];
  created_at: string;
}

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** POST /ai/chat response */
export interface AiChatResponse {
  conversation_id: string;
  user_message: AiMessage;
  assistant_message: AiMessage;
}

/** GET /ai/status */
export interface AiStatus {
  engine: 'gemini' | 'knowledge_base';
  gemini_configured: boolean;
  model: string | null;
}

export interface FloodSensor {
  id: string;
  name: string;
  location_text: string;
  latitude: number;
  longitude: number;
  advisory_cm: number;
  warning_cm: number;
  danger_cm: number;
  critical_cm: number;
  rapid_rise_cm_min: number;
  current_tier: FloodTier;
  last_depth_cm: number | null;
  last_rise_cm_min: number | null;
  last_reading_at: string | null;
  is_active: boolean;
  is_demo: boolean;
}

export interface SensorReading {
  id: number;
  sensor_id: string;
  distance_cm: number;
  depth_cm: number;
  rise_cm_min: number | null;
  tier: FloodTier;
  recorded_at: string;
}

export interface FloodAlert {
  id: string;
  sensor_id: string;
  tier: FloodTier;
  previous_tier: FloodTier;
  depth_cm: number;
  rise_cm_min: number | null;
  message: string;
  created_at: string;
  sensor?: { id: string; name: string; location_text: string };
}

export interface CountItem {
  key: string;
  count: number;
}

/** GET /dashboard/stats (admin + responder) — all values computed from DB */
export interface DashboardStats {
  totals: {
    residents: number;
    total_reports: number; // emergency + community
    pending_reports: number; // status != resolved
    resolved_reports: number;
    emergency_reports: number;
    cleanliness_reports: number; // community_reports where module = clean
    general_reports: number;
    volunteer_registrations: number; // non-cancelled
    upcoming_activities: number;
    published_announcements: number;
  };
  reports_by_status: CountItem[]; // keys: ReportStatus
  emergency_by_category: CountItem[];
  community_by_category: CountItem[];
  timeline: { date: string; emergency: number; community: number }[]; // last 14 days, YYYY-MM-DD
  recent_activity: {
    id: string;
    kind: 'emergency' | 'community' | 'announcement' | 'registration' | 'flood_alert';
    title: string;
    subtitle: string;
    status?: string;
    link: string;
    created_at: string;
  }[];
  insights: {
    // Rule-based community intelligence (see backend InsightsService)
    hotspots: { label: string; latitude: number; longitude: number; count: number; top_category: string }[];
    recurring: { category: string; count_last_30d: number; change_vs_prev_30d: number }[];
    avg_resolution_hours: number | null;
    high_priority_open: number;
    generated_at: string;
    method: string; // human-readable description of how insights were computed
  };
  flood: { sensors: number; highest_tier: FloodTier; active_alerts_24h: number };
}

/** GET /dashboard/resident */
export interface ResidentDashboard {
  my_reports: { total: number; open: number; resolved: number };
  recent_reports: Array<
    | (Pick<EmergencyReport, 'id' | 'reference_code' | 'title' | 'status' | 'created_at' | 'updated_at'> & { kind: 'emergency' })
    | (Pick<CommunityReport, 'id' | 'reference_code' | 'title' | 'status' | 'created_at' | 'updated_at' | 'module'> & { kind: 'community' })
  >;
  announcements: Announcement[]; // latest 5, pinned first
  upcoming_activities: CommunityActivity[]; // next 3
  my_registrations: number;
  flood: { highest_tier: FloodTier; sensors: FloodSensor[] };
}

/** GET /clean/summary */
export interface CleanSummary {
  total: number;
  open: number;
  resolved: number;
  resolved_last_30d: number;
  by_category: CountItem[];
  by_status: CountItem[];
  by_purok: CountItem[];
  recent: CommunityReport[];
}

/** Standard error body from the API */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

/** Socket.IO events (namespace "/realtime") */
export interface ServerToClientEvents {
  'notification:new': (n: AppNotification) => void;
  'emergency:new': (r: EmergencyReport) => void;
  'emergency:updated': (r: EmergencyReport) => void;
  'report:new': (r: CommunityReport) => void;
  'report:updated': (r: CommunityReport) => void;
  'announcement:new': (a: Announcement) => void;
  'activity:updated': (a: { id: string; action: 'created' | 'updated' | 'deleted' | 'registration' }) => void;
  'flood:reading': (p: { sensor: FloodSensor; reading: SensorReading }) => void;
  'flood:alert': (a: FloodAlert) => void;
  'dashboard:refresh': (p: { reason: string }) => void;
  'connection:ready': (p: { userId: string; roles: AppRole[] }) => void;
}
