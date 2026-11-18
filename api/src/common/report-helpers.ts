import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CommunityCategory, EmergencyCategory, ReportPriority } from './types';
import { unwrap } from './db';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export interface TriageResult {
  priority: ReportPriority;
  score: number;
  reasons: string[];
}

const EMERGENCY_BASE_SCORE: Record<EmergencyCategory, number> = {
  fire: 90,
  flood: 84,
  medical: 88,
  earthquake: 90,
  landslide: 86,
  crime: 82,
  accident: 80,
  missing_person: 85,
  power_outage: 62,
  other: 65,
};

const COMMUNITY_BASE_SCORE: Record<CommunityCategory, number> = {
  blocked_drainage: 68,
  water_pollution: 66,
  illegal_dumping: 60,
  garbage_accumulation: 55,
  sanitation: 58,
  air_pollution: 56,
  road_damage: 58,
  streetlight: 52,
  accessibility_obstacle: 62,
  stray_animals: 48,
  noise: 38,
  other: 42,
};

const HIGH_URGENCY_KEYWORDS = [
  { pattern: /\b(trapped|unconscious|bleeding|chest pain|stroke|drowning|collapsed)\b/i, bonus: 12, label: 'Critical life-safety keyword detected' },
  { pattern: /\b(school|elementary|high school|daycare|hospital|health center|clinic)\b/i, bonus: 8, label: 'Near school or health facility' },
  { pattern: /\b(elderly|senior|pwd|disabled|wheelchair|infant|baby|pregnant|children)\b/i, bonus: 8, label: 'Vulnerable residents affected' },
  { pattern: /\b(evacuation|bridge|main road|highway|blocked road|overflowing|rising water)\b/i, bonus: 7, label: 'Impacts evacuation route or critical infrastructure' },
  { pattern: /\b(sparks|live wire|transformer|gas leak|chemical|smoke|spreading)\b/i, bonus: 9, label: 'Active hazard progression reported' },
];

export function scoreEmergencyReport(input: {
  category: EmergencyCategory;
  title: string;
  description: string;
  locationText: string;
  peopleAffected?: number | null;
}): TriageResult {
  let score = EMERGENCY_BASE_SCORE[input.category] ?? 70;
  const reasons: string[] = [`Base severity for ${input.category.replace(/_/g, ' ')} (${score})`];
  const combined = `${input.title} ${input.description} ${input.locationText}`;

  for (const kw of HIGH_URGENCY_KEYWORDS) {
    if (kw.pattern.test(combined)) {
      score += kw.bonus;
      reasons.push(`${kw.label} (+${kw.bonus})`);
    }
  }

  if (typeof input.peopleAffected === 'number' && input.peopleAffected > 0) {
    const peopleBonus = Math.min(12, Math.ceil(input.peopleAffected / 3) * 3);
    score += peopleBonus;
    reasons.push(`${input.peopleAffected} person(s) affected (+${peopleBonus})`);
  }

  score = Math.max(0, Math.min(100, score));
  const priority: ReportPriority =
    score >= 85 ? 'critical' : score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
  return { priority, score, reasons };
}

export function scoreCommunityReport(input: {
  category: CommunityCategory;
  title: string;
  description: string;
  locationText: string;
  nearbyRecentCount?: number;
}): TriageResult {
  let score = COMMUNITY_BASE_SCORE[input.category] ?? 45;
  const reasons: string[] = [`Category baseline: ${input.category.replace(/_/g, ' ')} (${score})`];
  const combined = `${input.title} ${input.description} ${input.locationText}`;

  for (const kw of HIGH_URGENCY_KEYWORDS) {
    if (kw.pattern.test(combined)) {
      score += kw.bonus;
      reasons.push(`${kw.label} (+${kw.bonus})`);
    }
  }

  if (input.nearbyRecentCount && input.nearbyRecentCount >= 2) {
    const clusterBonus = Math.min(15, input.nearbyRecentCount * 4);
    score += clusterBonus;
    reasons.push(`Recurring category hotspot (${input.nearbyRecentCount} recent reports, +${clusterBonus})`);
  }

  score = Math.max(0, Math.min(100, score));
  const priority: ReportPriority =
    score >= 82 ? 'critical' : score >= 65 ? 'high' : score >= 42 ? 'medium' : 'low';
  return { priority, score, reasons };
}

export async function uploadReportAttachment(params: {
  supabase: SupabaseService;
  file?: Express.Multer.File;
  userId: string;
  kind: 'emergency' | 'community';
  reportId: string;
}) {
  const { supabase, file, userId, kind, reportId } = params;
  if (!file) return null;

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed');
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new BadRequestException('Image must be 5 MB or smaller');
  }

  const ext =
    file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${userId}/${kind}/${reportId}/${randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.admin.storage
    .from(supabase.bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadErr) {
    throw new BadRequestException(`Image upload failed: ${uploadErr.message}`);
  }

  const row = unwrap(
    await supabase.admin
      .from('report_attachments')
      .insert({
        emergency_report_id: kind === 'emergency' ? reportId : null,
        community_report_id: kind === 'community' ? reportId : null,
        uploaded_by: userId,
        storage_path: storagePath,
        file_name: file.originalname.slice(0, 140),
        mime_type: file.mimetype,
        size_bytes: file.size,
      })
      .select('*')
      .single(),
    'Failed to save attachment metadata',
  );

  return row;
}

export async function hydrateAttachments(
  supabase: SupabaseService,
  rows: Array<{
    id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>,
) {
  const out = [];
  for (const a of rows) {
    const { data } = await supabase.admin.storage
      .from(supabase.bucket)
      .createSignedUrl(a.storage_path, 3600);
    out.push({
      id: a.id,
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      created_at: a.created_at,
      url: data?.signedUrl ?? null,
    });
  }
  return out;
}
