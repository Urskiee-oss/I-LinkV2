/**
 * I-Link MVP — Database Seeder
 * Creates clearly labeled demo accounts (Admin, Responder, Resident) and
 * realistic barangay sample data (Cebu City context, CIT-U / Quintet.Dev).
 *
 * Run: cd api && npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ILinkDemo2026!';
const DEMO_SENSOR_KEY = process.env.FLOOD_DEVICE_KEY || 'ilink_demo_kinalumsan_sensor_key_2026';

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT') || SERVICE_KEY.length < 20) {
  console.error(
    'ERROR: Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in api/.env before running npm run seed.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureDemoUser(params: {
  email: string;
  fullName: string;
  role: 'admin' | 'responder' | 'resident';
  phone: string;
  purok: string;
  address: string;
}): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === params.email.toLowerCase());

  let userId: string;
  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: params.fullName, phone: params.phone, purok: params.purok },
    });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: params.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: params.fullName, phone: params.phone, purok: params.purok },
    });
    if (error || !data.user) throw new Error(`Failed to create ${params.email}: ${error?.message}`);
    userId = data.user.id;
  }

  await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: params.fullName,
      email: params.email,
      phone: params.phone,
      purok: params.purok,
      address: params.address,
      is_active: true,
      is_demo: true,
    },
    { onConflict: 'id' },
  );

  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('user_roles').insert({ user_id: userId, role: params.role });
  return userId;
}

async function main() {
  console.log('Seeding I-Link MVP demo accounts & sample data...');

  const adminId = await ensureDemoUser({
    email: 'admin@ilink.demo',
    fullName: 'Punong Barangay Elena M. Reyes (Demo Admin)',
    role: 'admin',
    phone: '+63 917 555 0101',
    purok: 'Purok 1 - Centro',
    address: 'Barangay Hall Compound, N. Bacalso Ave., Cebu City',
  });

  const responderId = await ensureDemoUser({
    email: 'responder@ilink.demo',
    fullName: 'BDRRMC Lead Marco D. Santos (Demo Responder)',
    role: 'responder',
    phone: '+63 917 555 0102',
    purok: 'Purok 2 - Riverside',
    address: 'BDRRMC Command Post, Barangay Labangon, Cebu City',
  });

  const residentId = await ensureDemoUser({
    email: 'resident@ilink.demo',
    fullName: 'Andrea L. Villanueva (Demo Resident)',
    role: 'resident',
    phone: '+63 917 555 0103',
    purok: 'Purok 3 - Sitio Riverside',
    address: '42 Katipunan St., Purok 3, Cebu City',
  });

  // Services
  const services = [
    {
      name: 'Barangay Clearance',
      category: 'certificate',
      description:
        'Official certification confirming good moral standing and residency in the barangay for employment, business, or ID applications.',
      requirements: [
        'Valid government-issued ID or school ID',
        'Community Tax Certificate (Cedula) for the current year',
        'Purok Clearance or Certificate of Residency signed by Purok Leader',
      ],
      procedure_steps: [
        'Present requirements at Window 1 (Records & Verification Desk).',
        'Pay the corresponding clearance fee at Window 2 (Barangay Treasurer).',
        'Have your photo and signature captured at Window 3.',
        'Claim the signed and dry-sealed Barangay Clearance (15–20 minutes).',
      ],
      fee: 'PHP 50.00 (Free for first-time jobseekers under RA 11261)',
      processing_time: '15–20 minutes',
      office: 'Barangay Hall — Ground Floor, Records Section',
      office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
      contact_number: '(032) 261-4401',
      contact_email: 'records@barangay-ilink.gov.ph',
      is_active: true,
      created_by: adminId,
    },
    {
      name: 'Certificate of Indigency',
      category: 'certificate',
      description:
        'Issued to qualified low-income residents seeking medical, educational, burial, or legal assistance from DSWD, PCSO, or scholarship programs.',
      requirements: [
        'Valid ID or voter certification of applicant or immediate family member',
        'Brief written request or hospital bill / scholarship endorsement',
        'Purok Leader attestation of household status',
      ],
      procedure_steps: [
        'Submit requirements at the Social Services Desk (Window 1).',
        'Undergo brief verification interview with the Barangay Social Worker.',
        'Receive signed Certificate of Indigency from the Punong Barangay office.',
      ],
      fee: 'Free (PHP 0.00)',
      processing_time: '15 minutes',
      office: 'Barangay Hall — Social Services Desk',
      office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
      contact_number: '(032) 261-4402',
      contact_email: 'socialservices@barangay-ilink.gov.ph',
      is_active: true,
      created_by: adminId,
    },
    {
      name: 'Barangay Business Permit Clearance',
      category: 'permit',
      description:
        'Mandatory barangay endorsement required for new business registration or annual renewal with the City Business Permits and Licensing Office (BPLO).',
      requirements: [
        'DTI Business Name Registration (sole proprietorship) or SEC Registration',
        'Contract of Lease or Transfer Certificate of Title for business address',
        'Previous year Barangay Business Clearance (for renewals)',
      ],
      procedure_steps: [
        'Submit documents at Window 2 (Business & Treasury Section).',
        'Pay barangay business clearance fee based on business classification.',
        'Release of signed Barangay Business Clearance with official receipt.',
      ],
      fee: 'PHP 200.00 – PHP 1,000.00 (based on capital classification)',
      processing_time: '30 minutes',
      office: 'Barangay Hall — Treasury & Licensing Section',
      office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
      contact_number: '(032) 261-4403',
      contact_email: 'treasury@barangay-ilink.gov.ph',
      is_active: true,
      created_by: adminId,
    },
    {
      name: 'Katarungang Pambarangay (Lupong Tagapamayapa) Mediation',
      category: 'legal',
      description:
        'Community dispute resolution and mediation service prior to court filing in accordance with the Local Government Code (RA 7160).',
      requirements: [
        'Valid ID of complainant',
        'Complete name and address of respondent within the barangay',
        'Written narrative of complaint and relief sought',
      ],
      procedure_steps: [
        'File complaint form at the Lupong Tagapamayapa Desk.',
        'Receive scheduled summons date for Punong Barangay mediation.',
        'Attend mediation/conciliation conferences as scheduled.',
      ],
      fee: 'Free (PHP 0.00)',
      processing_time: '1–3 scheduled mediation hearings',
      office: 'Barangay Hall — 2nd Floor, Lupon Session Room',
      office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
      contact_number: '(032) 261-4404',
      contact_email: 'lupon@barangay-ilink.gov.ph',
      is_active: true,
      created_by: adminId,
    },
  ];
  await supabase.from('barangay_services').upsert(services, { onConflict: 'name' });

  // Clear previous demo rows before re-inserting
  await supabase.from('announcements').delete().eq('is_demo', true);
  await supabase.from('community_locations').delete().eq('is_demo', true);
  await supabase.from('community_activities').delete().eq('is_demo', true);
  await supabase.from('emergency_reports').delete().eq('is_demo', true);
  await supabase.from('community_reports').delete().eq('is_demo', true);
  await supabase.from('flood_sensors').delete().eq('is_demo', true);

  // Announcements
  await supabase.from('announcements').insert([
    {
      author_id: adminId,
      title: '[DEMO] Rainy Season Flood Preparedness & Four-Tier Early Warning Activation',
      summary:
        'Our IoT ultrasonic flood sensor at Kinalumsan River Bridge is active. Review the PAGASA-aligned Advisory, Warning, Danger, and Critical alert thresholds.',
      body: `The Barangay Disaster Risk Reduction and Management Committee (BDRRMC) reminds all residents—especially households in Purok 2 and Purok 3 Riverside—that the I-Link IoT Flood Early Warning Node at Kinalumsan Bridge is transmitting live telemetry every 10 seconds.\n\nTiered Alert Actions:\n• YELLOW (Advisory, ≥50 cm): Monitor I-Link alerts and secure ground-floor valuables.\n• ORANGE (Warning, ≥100 cm): Prepare emergency go-bags, medicines, and documents; assist senior citizens and PWDs.\n• RED (Danger, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to Labangon Elementary School Gymnasium.\n• DARK RED (Critical, ≥200 cm): Mandatory evacuation in progress; contact BDRRMC Rescue or call 911 immediately.`,
      category: 'disaster_preparedness',
      priority: 'urgent',
      is_published: true,
      is_pinned: true,
      is_demo: true,
    },
    {
      author_id: adminId,
      title: '[DEMO] Saturday Bayanihan Canal Declogging & Solid Waste Segregation Drive',
      summary:
        'Join volunteers this Saturday at 6:30 AM at Purok 3 Sitio Riverside to clear drainage waterways identified by I-Link Clean hotspot analytics.',
      body: `I-Link Clean spatial clustering identified recurring drainage blockages along Katipunan Extension and Purok 3 creekside. The Barangay Environment Committee invites residents, SK youth, and student volunteers to register via I-Link Bayanihan.\n\nGloves, sacks, and refreshments will be provided at the assembly point in front of the Barangay Covered Court.`,
      category: 'environment',
      priority: 'important',
      is_published: true,
      is_pinned: false,
      is_demo: true,
    },
    {
      author_id: adminId,
      title: '[DEMO] Free Maternal, Senior & PWD Medical Checkup at Barangay Health Center',
      summary:
        'Free blood pressure screening, maintenance medicine distribution, and prenatal checkups every Wednesday 8:00 AM – 12:00 NN.',
      body: `Bring your Barangay Health Card or valid ID to the Barangay Health Center. Wheelchairs and accessible ramps are available at the main entrance (verified on I-Link Access Map).`,
      category: 'health',
      priority: 'normal',
      is_published: true,
      is_pinned: false,
      is_demo: true,
    },
  ]);

  // Community map locations (around N. Bacalso / Labangon / CIT-U Cebu City)
  await supabase.from('community_locations').insert([
    {
      name: 'Barangay Command & Administrative Hall (Demo)',
      category: 'barangay_hall',
      description: '24/7 BDRRMC operations desk, barangay clearances, and Lupon office.',
      address: 'N. Bacalso Ave., Cebu City',
      latitude: 10.2948,
      longitude: 123.8814,
      contact_number: '(032) 261-4401',
      capacity: 120,
      is_accessible: true,
      is_public: true,
      is_demo: true,
      created_by: adminId,
    },
    {
      name: 'Labangon Community Evacuation Gymnasium (Demo)',
      category: 'evacuation_center',
      description:
        'Primary flood and typhoon evacuation center with generator backup, water station, and PWD accessibility ramp.',
      address: 'Katipunan St., Cebu City',
      latitude: 10.2974,
      longitude: 123.8832,
      contact_number: '(032) 261-4490',
      capacity: 450,
      is_accessible: true,
      is_public: true,
      is_demo: true,
      created_by: adminId,
    },
    {
      name: 'Barangay Primary Health & Birthing Center (Demo)',
      category: 'health_center',
      description: 'First-aid triage, maternal care, immunization, and emergency stabilization.',
      address: 'Tres de Abril St., Cebu City',
      latitude: 10.2959,
      longitude: 123.8798,
      contact_number: '(032) 261-4412',
      capacity: 60,
      is_accessible: true,
      is_public: true,
      is_demo: true,
      created_by: adminId,
    },
    {
      name: 'Cebu Institute of Technology – University Campus Assembly Point (Demo)',
      category: 'school',
      description: 'Partner academic institution and secondary emergency assembly zone.',
      address: 'N. Bacalso Ave., Cebu City',
      latitude: 10.2945,
      longitude: 123.8811,
      contact_number: '(032) 261-7741',
      capacity: 800,
      is_accessible: true,
      is_public: true,
      is_demo: true,
      created_by: adminId,
    },
    {
      name: 'Kinalumsan Creek Low-Lying Flood Hazard Zone (Demo)',
      category: 'flood_prone_area',
      description:
        'Historical flash-flood zone monitored by Ultrasonic IoT Node #1. Pre-emptive evacuation triggered at Danger tier.',
      address: 'Purok 3 Sitio Riverside, Cebu City',
      latitude: 10.2932,
      longitude: 123.8842,
      contact_number: '(032) 261-4401',
      capacity: null,
      is_accessible: false,
      is_public: true,
      is_demo: true,
      created_by: adminId,
    },
  ]);

  // Bayanihan activities
  const in3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const in3DaysEnd = new Date(Date.now() + 3 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString();
  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: createdActivities } = await supabase
    .from('community_activities')
    .insert([
      {
        title: '[DEMO] Purok 3 Creekside Drainage Declogging & Clean-Up',
        description:
          'Collaborative waterway clearing and plastic waste recovery prior to heavy monsoon rains. Tools and PPE provided.',
        activity_type: 'environmental',
        is_volunteer_opportunity: true,
        location_text: 'Purok 3 Riverside Footbridge Assembly Area',
        latitude: 10.2934,
        longitude: 123.8839,
        starts_at: in3Days,
        ends_at: in3DaysEnd,
        max_participants: 40,
        status: 'upcoming',
        organizer_id: adminId,
        is_demo: true,
      },
      {
        title: '[DEMO] Barangay Flood Evacuation Drill & First-Aid Workshop',
        description:
          'Hands-on orientation on I-Link 4-tier flood alerts, evacuation routing for senior citizens/PWDs, and basic life support.',
        activity_type: 'disaster_response',
        is_volunteer_opportunity: true,
        location_text: 'Labangon Community Evacuation Gymnasium',
        latitude: 10.2974,
        longitude: 123.8832,
        starts_at: in7Days,
        ends_at: null,
        max_participants: 60,
        status: 'upcoming',
        organizer_id: responderId,
        is_demo: true,
      },
    ])
    .select('id');

  if (createdActivities && createdActivities[0]) {
    await supabase.from('volunteer_registrations').upsert(
      {
        activity_id: createdActivities[0].id,
        user_id: residentId,
        status: 'confirmed',
        skills: 'Waste sorting, community coordination',
        notes: 'Demo volunteer registration',
      },
      { onConflict: 'activity_id,user_id' },
    );
  }

  // Emergency & Community Reports (marked is_demo: true)
  await supabase.from('emergency_reports').insert([
    {
      reporter_id: residentId,
      category: 'flood',
      title: '[DEMO SIMULATION] Rapidly rising creek water near Purok 3 footbridge',
      description:
        'SIMULATED DEMO REPORT: Water level rose knee-deep after 30 minutes of heavy downpour near the elementary school crossing. Two elderly residents need assistance moving to higher ground.',
      location_text: 'Purok 3 Sitio Riverside Footbridge, near school crossing',
      latitude: 10.2933,
      longitude: 123.884,
      people_affected: 6,
      status: 'responding',
      priority: 'critical',
      priority_score: 96,
      priority_reasons: [
        'Base severity for flood (84)',
        'Near school or health facility (+8)',
        'Vulnerable residents affected (+8)',
        '6 person(s) affected (+6)',
      ],
      assigned_to: responderId,
      is_demo: true,
    },
    {
      reporter_id: residentId,
      category: 'power_outage',
      title: '[DEMO SIMULATION] Sparking low-hanging service wire along Tres de Abril',
      description:
        'SIMULATED DEMO REPORT: Service drop wire snagged by passing truck is sparking intermittently above the pedestrian sidewalk.',
      location_text: 'Tres de Abril St. corner Katipunan, Purok 2',
      latitude: 10.2957,
      longitude: 123.8803,
      people_affected: 15,
      status: 'under_review',
      priority: 'high',
      priority_score: 79,
      priority_reasons: [
        'Base severity for power outage (62)',
        'Active hazard progression reported (+9)',
        '15 person(s) affected (+12)',
      ],
      assigned_to: responderId,
      is_demo: true,
    },
  ]);

  await supabase.from('community_reports').insert([
    {
      reporter_id: residentId,
      module: 'clean',
      category: 'blocked_drainage',
      title: '[DEMO] Culvert grate clogged with plastic waste causing street ponding',
      description:
        'Drainage inlet beside Purok 3 sari-sari store is packed with plastic bottles and silt, causing ankle-deep water even during light rain.',
      location_text: 'Purok 3 Sitio Riverside, Katipunan Ext.',
      latitude: 10.2935,
      longitude: 123.8837,
      status: 'under_review',
      priority: 'high',
      priority_score: 76,
      priority_reasons: [
        'Category baseline: blocked drainage (68)',
        'Recurring category hotspot (+8)',
      ],
      is_public: true,
      assigned_to: responderId,
      is_demo: true,
    },
    {
      reporter_id: residentId,
      module: 'clean',
      category: 'garbage_accumulation',
      title: '[DEMO] Uncollected mixed waste sacks at Purok 2 collection corner',
      description:
        'Several unsegregated trash bags left outside collection schedule attracting stray dogs.',
      location_text: 'Purok 2 Corner Alley, Tres de Abril',
      latitude: 10.2954,
      longitude: 123.8808,
      status: 'submitted',
      priority: 'medium',
      priority_score: 55,
      priority_reasons: ['Category baseline: garbage accumulation (55)'],
      is_public: true,
      is_demo: true,
    },
    {
      reporter_id: residentId,
      module: 'general',
      category: 'accessibility_obstacle',
      title: '[DEMO] Cracked concrete curb blocking wheelchair ramp near health center',
      description:
        'Broken concrete slab at the sidewalk ramp makes it difficult for wheelchair users and senior citizens to access the Barangay Health Center entrance.',
      location_text: 'Front of Barangay Primary Health Center, Tres de Abril St.',
      latitude: 10.296,
      longitude: 123.8799,
      status: 'resolved',
      priority: 'high',
      priority_score: 78,
      priority_reasons: [
        'Category baseline: accessibility obstacle (62)',
        'Near school or health facility (+8)',
        'Vulnerable residents affected (+8)',
      ],
      is_public: true,
      resolved_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      is_demo: true,
    },
  ]);

  // Verified Knowledge Base Articles for I-Link AI
  await supabase.from('knowledge_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('knowledge_articles').insert([
    {
      topic: 'emergency_procedure',
      question: 'What do the four I-Link Flood Alert Tiers (Advisory, Warning, Danger, Critical) mean?',
      answer:
        'I-Link uses an ultrasonic IoT sensor measuring water depth and rise velocity (cm/min) every 10 seconds, aligned with PAGASA and NDRRMC protocols:\n• Advisory (Yellow, ≥50 cm): Monitor water levels and prepare household supplies.\n• Warning (Orange, ≥100 cm): Pack go-bags and prepare senior citizens, children, and PWDs.\n• Danger (Red, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to designated evacuation centers.\n• Critical (Dark Red, ≥200 cm): Immediate mandatory evacuation; call 911 or BDRRMC responders.',
      keywords: ['flood', 'tier', 'advisory', 'warning', 'danger', 'critical', 'pagasa', 'sensor', 'water'],
      source: 'BDRRMC Flood Protocol (Verified)',
      is_active: true,
    },
    {
      topic: 'faq',
      question: 'How do I submit an emergency or community cleanliness report on I-Link?',
      answer:
        '1. For immediate hazards (fire, flood, medical, accident), open "I-Link Emergency", choose a category, describe the situation, click the map or "Use my location" to geotag, optionally attach a photo, and submit. BDRRMC responders receive a sub-5-second real-time alert.\n2. For garbage, clogged canals, or sanitation issues, open "I-Link Clean".\n3. You can track status transitions (Submitted → Under Review → Responding → Resolved) in "My Reports".',
      keywords: ['report', 'submit', 'emergency', 'clean', 'garbage', 'status', 'track'],
      source: 'I-Link Platform Guide (Verified)',
      is_active: true,
    },
    {
      topic: 'emergency_procedure',
      question: 'What are the emergency hotlines and evacuation centers in our barangay?',
      answer:
        'National Emergency Hotline: 911 | Bureau of Fire Protection (BFP): 160 | Philippine National Police (PNP): 117 | Barangay BDRRMC Desk: (032) 261-4401. Our primary evacuation center is Labangon Community Evacuation Gymnasium (Katipunan St., capacity 450, PWD-accessible).',
      keywords: ['hotline', '911', 'evacuation', 'phone', 'contact', 'fire', 'police', 'rescue'],
      source: 'Barangay Emergency Directory (Verified)',
      is_active: true,
    },
  ]);

  // IoT Flood Sensor + baseline telemetry
  const keyHash = createHash('sha256').update(DEMO_SENSOR_KEY).digest('hex');
  const { data: sensor } = await supabase
    .from('flood_sensors')
    .insert({
      name: 'Node #1 — Kinalumsan River Bridge (Demo IoT)',
      location_text: 'Purok 3 Sitio Riverside Footbridge, Cebu City',
      latitude: 10.2932,
      longitude: 123.8842,
      device_key_hash: keyHash,
      sensor_height_cm: 400,
      advisory_cm: 50,
      warning_cm: 100,
      danger_cm: 150,
      critical_cm: 200,
      rapid_rise_cm_min: 2.0,
      current_tier: 'advisory',
      last_depth_cm: 62,
      last_rise_cm_min: 1.2,
      last_reading_at: new Date().toISOString(),
      is_active: true,
      is_demo: true,
    })
    .select('*')
    .single();

  if (sensor) {
    const sampleDepths = [28, 32, 36, 42, 48, 53, 58, 62];
    const readings = sampleDepths.map((depth, idx) => ({
      sensor_id: sensor.id,
      distance_cm: 400 - depth,
      depth_cm: depth,
      rise_cm_min: idx === 0 ? 0 : Number(((depth - sampleDepths[idx - 1]) / 2).toFixed(2)),
      tier: depth >= 50 ? 'advisory' : 'normal',
      recorded_at: new Date(Date.now() - (sampleDepths.length - idx) * 120000).toISOString(),
    }));
    await supabase.from('sensor_readings').insert(readings);
    await supabase.from('flood_alerts').insert({
      sensor_id: sensor.id,
      tier: 'advisory',
      previous_tier: 'normal',
      depth_cm: 53,
      rise_cm_min: 1.25,
      message:
        '[DEMO YELLOW ADVISORY] Node #1 — Kinalumsan River Bridge water depth reached 53 cm. Monitor updates closely.',
    });
  }

  console.log('\n=== I-Link MVP Seed Complete ===');
  console.log('Demo Accounts (password for all: ' + DEMO_PASSWORD + '):');
  console.log('  • Barangay Admin : admin@ilink.demo');
  console.log('  • BDRRMC Responder: responder@ilink.demo');
  console.log('  • Resident       : resident@ilink.demo');
  console.log('Demo Flood Sensor Key (FLOOD_DEVICE_KEY): ' + DEMO_SENSOR_KEY);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
