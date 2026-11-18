export type AppRole = 'resident' | 'admin' | 'responder';
export const APP_ROLES: AppRole[] = ['resident', 'admin', 'responder'];

export type ReportStatus = 'submitted' | 'under_review' | 'responding' | 'resolved';
export const REPORT_STATUSES: ReportStatus[] = ['submitted', 'under_review', 'responding', 'resolved'];

export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';

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
export const COMMUNITY_CATEGORIES = [...CLEAN_CATEGORIES, ...GENERAL_CATEGORIES] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const LOCATION_CATEGORIES = [
  'barangay_hall', 'health_center', 'evacuation_center', 'school', 'police_station',
  'fire_station', 'hospital', 'flood_prone_area', 'accessible_facility', 'public_facility', 'other',
] as const;

export const ACTIVITY_TYPES = [
  'community_program', 'environmental', 'disaster_response',
  'volunteer_program', 'community_project', 'donation_drive',
] as const;
export const ACTIVITY_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'] as const;
export const REGISTRATION_STATUSES = ['registered', 'confirmed', 'attended', 'cancelled'] as const;
export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'urgent'] as const;

export type FloodTier = 'normal' | 'advisory' | 'warning' | 'danger' | 'critical';
export const FLOOD_TIERS: FloodTier[] = ['normal', 'advisory', 'warning', 'danger', 'critical'];

/** The authenticated principal attached to every request / socket. */
export interface AuthUser {
  id: string;
  email: string;
  roles: AppRole[];
  primaryRole: AppRole;
  fullName: string;
}

export function primaryRoleOf(roles: AppRole[]): AppRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('responder')) return 'responder';
  return 'resident';
}

export function isStaff(user: AuthUser): boolean {
  return user.roles.includes('admin') || user.roles.includes('responder');
}
