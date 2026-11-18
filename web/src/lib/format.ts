import type { FloodTier, ReportPriority, ReportStatus } from './types';

const TZ = 'Asia/Manila';

const LABELS: Record<string, string> = {
  under_review: 'Under Review',
  power_outage: 'Power Outage',
  missing_person: 'Missing Person',
  garbage_accumulation: 'Garbage Accumulation',
  illegal_dumping: 'Illegal Dumping',
  blocked_drainage: 'Blocked Drainage',
  air_pollution: 'Air Pollution',
  water_pollution: 'Water Pollution',
  stray_animals: 'Stray Animals',
  road_damage: 'Road Damage',
  streetlight: 'Streetlight',
  accessibility_obstacle: 'Accessibility Obstacle',
  barangay_hall: 'Barangay Hall',
  health_center: 'Health Center',
  evacuation_center: 'Evacuation Center',
  police_station: 'Police Station',
  fire_station: 'Fire Station',
  flood_prone_area: 'Flood-prone Area',
  accessible_facility: 'Accessible Facility',
  public_facility: 'Public Facility',
  community_program: 'Community Program',
  disaster_response: 'Disaster Response',
  volunteer_program: 'Volunteer Program',
  community_project: 'Community Project',
  donation_drive: 'Donation Drive',
  clean: 'I-Link Clean',
  general: 'Community',
  knowledge_base: 'Knowledge base',
  flood_alert: 'Flood alert',
};

export function humanize(key: string | null | undefined): string {
  if (!key) return '—';
  if (LABELS[key]) return LABELS[key];
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const STATUS_ORDER: ReportStatus[] = ['submitted', 'under_review', 'responding', 'resolved'];
export const PRIORITY_ORDER: ReportPriority[] = ['low', 'medium', 'high', 'critical'];
export const TIER_ORDER: FloodTier[] = ['normal', 'advisory', 'warning', 'danger', 'critical'];

export const TIER_COLORS: Record<FloodTier, string> = {
  normal: '#16A34A',
  advisory: '#EAB308',
  warning: '#F97316',
  danger: '#DC2626',
  critical: '#7F1D1D',
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-PH', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function formatDateTime(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
}

export function formatShortDay(v: string): string {
  // v = YYYY-MM-DD
  const d = toDate(`${v}T00:00:00+08:00`);
  if (!d) return v;
  return new Intl.DateTimeFormat('en-PH', { timeZone: TZ, month: 'short', day: 'numeric' }).format(d);
}

export function timeAgo(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return formatDate(v);
}

export function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Convert ISO string to value for <input type="datetime-local"> in Manila time. */
export function toManilaInput(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}`;
}

/** Convert datetime-local value (interpreted as Manila time) to ISO string. */
export function fromManilaInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(`${v}:00+08:00`);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-PH', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
