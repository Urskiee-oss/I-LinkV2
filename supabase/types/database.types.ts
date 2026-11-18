/**
 * I-Link MVP — Supabase Generated Database Schema Types
 * Matches `supabase/migrations/20261118000001_schema.sql`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'resident' | 'admin' | 'responder';
export type ReportStatus = 'submitted' | 'under_review' | 'responding' | 'resolved';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type EmergencyCategory =
  | 'fire'
  | 'flood'
  | 'medical'
  | 'crime'
  | 'accident'
  | 'earthquake'
  | 'landslide'
  | 'power_outage'
  | 'missing_person'
  | 'other';
export type CommunityCategory =
  | 'garbage_accumulation'
  | 'illegal_dumping'
  | 'blocked_drainage'
  | 'sanitation'
  | 'air_pollution'
  | 'water_pollution'
  | 'noise'
  | 'stray_animals'
  | 'road_damage'
  | 'streetlight'
  | 'accessibility_obstacle'
  | 'other';
export type ReportModule = 'clean' | 'general';
export type LocationCategory =
  | 'barangay_hall'
  | 'health_center'
  | 'evacuation_center'
  | 'school'
  | 'police_station'
  | 'fire_station'
  | 'hospital'
  | 'flood_prone_area'
  | 'accessible_facility'
  | 'public_facility'
  | 'other';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';
export type ActivityType =
  | 'community_program'
  | 'environmental'
  | 'disaster_response'
  | 'volunteer_program'
  | 'community_project'
  | 'donation_drive';
export type ActivityStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type RegistrationStatus = 'registered' | 'confirmed' | 'attended' | 'cancelled';
export type FloodTier = 'normal' | 'advisory' | 'warning' | 'danger' | 'critical';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
      };
      emergency_reports: {
        Row: {
          id: string;
          reference_code: string;
          reporter_id: string;
          category: EmergencyCategory;
          title: string;
          description: string;
          location_text: string;
          latitude: number | null;
          longitude: number | null;
          people_affected: number | null;
          status: ReportStatus;
          priority: ReportPriority;
          priority_score: number;
          priority_reasons: string[];
          assigned_to: string | null;
          is_demo: boolean;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      community_reports: {
        Row: {
          id: string;
          reference_code: string;
          reporter_id: string;
          module: ReportModule;
          category: CommunityCategory;
          title: string;
          description: string;
          location_text: string;
          latitude: number | null;
          longitude: number | null;
          status: ReportStatus;
          priority: ReportPriority;
          priority_score: number;
          priority_reasons: string[];
          is_public: boolean;
          assigned_to: string | null;
          is_demo: boolean;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      report_attachments: {
        Row: {
          id: string;
          emergency_report_id: string | null;
          community_report_id: string | null;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
          updated_at: string;
        };
      };
      report_updates: {
        Row: {
          id: string;
          emergency_report_id: string | null;
          community_report_id: string | null;
          author_id: string;
          from_status: ReportStatus | null;
          to_status: ReportStatus | null;
          note: string | null;
          is_internal: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      announcements: {
        Row: {
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
        };
      };
      community_locations: {
        Row: {
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
          created_by: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      barangay_services: {
        Row: {
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
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      community_activities: {
        Row: {
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
        };
      };
      volunteer_registrations: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          status: RegistrationStatus;
          skills: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          link: string | null;
          data: Json;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          engine: 'knowledge_base' | 'gemini' | null;
          sources: Json;
          suggested_actions: Json;
          created_at: string;
          updated_at: string;
        };
      };
      knowledge_articles: {
        Row: {
          id: string;
          topic: string;
          question: string;
          answer: string;
          keywords: string[];
          source: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      flood_sensors: {
        Row: {
          id: string;
          name: string;
          location_text: string;
          latitude: number;
          longitude: number;
          device_key_hash: string;
          sensor_height_cm: number;
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
          created_at: string;
          updated_at: string;
        };
      };
      sensor_readings: {
        Row: {
          id: number;
          sensor_id: string;
          distance_cm: number;
          depth_cm: number;
          rise_cm_min: number | null;
          tier: FloodTier;
          recorded_at: string;
          created_at: string;
        };
      };
      flood_alerts: {
        Row: {
          id: string;
          sensor_id: string;
          tier: FloodTier;
          previous_tier: FloodTier;
          depth_cm: number;
          rise_cm_min: number | null;
          message: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: {
      app_role: AppRole;
      report_status: ReportStatus;
      report_priority: ReportPriority;
      emergency_category: EmergencyCategory;
      community_category: CommunityCategory;
      report_module: ReportModule;
      location_category: LocationCategory;
      announcement_priority: AnnouncementPriority;
      activity_type: ActivityType;
      activity_status: ActivityStatus;
      registration_status: RegistrationStatus;
      flood_tier: FloodTier;
    };
  };
}
