/**
 * I-Link MVP — Built-in Local Postgres/Auth/Storage Compatibility Store
 *
 * When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in `api/.env`,
 * the NestJS backend uses your live Supabase Cloud / CLI project directly.
 *
 * When Supabase credentials are NOT yet configured, this store provides a drop-in
 * `@supabase/supabase-js`-compatible query builder, Auth provider, and Storage
 * signed-URL engine backed by `api/.local-db.json` and pre-seeded with the full
 * Cebu Barangay demo dataset (`admin@ilink.demo`, `responder@ilink.demo`,
 * `resident@ilink.demo`). That way the entire platform works end-to-end out of
 * the box and switches seamlessly to Supabase Cloud once keys are added.
 */
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type Row = Record<string, any>;

const LOCAL_USERS = {
  admin: '11111111-1111-4111-8111-111111111101',
  responder: '11111111-1111-4111-8111-111111111102',
  resident: '11111111-1111-4111-8111-111111111103',
};

function defaultStore(): Record<string, Row[]> {
  const now = Date.now();
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();
  const sensorId = '22222222-2222-4222-8222-222222222201';
  const act1Id = '33333333-3333-4333-8333-333333333301';
  const act2Id = '33333333-3333-4333-8333-333333333302';
  const em1Id = '44444444-4444-4444-8444-444444444401';
  const em2Id = '44444444-4444-4444-8444-444444444402';
  const cr1Id = '55555555-5555-4555-8555-555555555501';
  const cr2Id = '55555555-5555-4555-8555-555555555502';
  const cr3Id = '55555555-5555-4555-8555-555555555503';

  return {
    auth_users: [
      {
        id: LOCAL_USERS.admin,
        email: 'admin@ilink.demo',
        password: process.env.DEMO_PASSWORD || 'ILinkDemo2026!',
        user_metadata: {
          full_name: 'Punong Barangay Elena M. Reyes (Demo Admin)',
          phone: '+63 917 555 0101',
          purok: 'Purok 1 - Centro',
        },
      },
      {
        id: LOCAL_USERS.responder,
        email: 'responder@ilink.demo',
        password: process.env.DEMO_PASSWORD || 'ILinkDemo2026!',
        user_metadata: {
          full_name: 'BDRRMC Lead Marco D. Santos (Demo Responder)',
          phone: '+63 917 555 0102',
          purok: 'Purok 2 - Riverside',
        },
      },
      {
        id: LOCAL_USERS.resident,
        email: 'resident@ilink.demo',
        password: process.env.DEMO_PASSWORD || 'ILinkDemo2026!',
        user_metadata: {
          full_name: 'Andrea L. Villanueva (Demo Resident)',
          phone: '+63 917 555 0103',
          purok: 'Purok 3 - Sitio Riverside',
        },
      },
    ],
    profiles: [
      {
        id: LOCAL_USERS.admin,
        full_name: 'Punong Barangay Elena M. Reyes (Demo Admin)',
        email: 'admin@ilink.demo',
        phone: '+63 917 555 0101',
        purok: 'Purok 1 - Centro',
        address: 'Barangay Hall Compound, N. Bacalso Ave., Cebu City',
        avatar_url: null,
        is_active: true,
        is_demo: true,
        created_at: iso(-14 * 86400000),
        updated_at: iso(-14 * 86400000),
      },
      {
        id: LOCAL_USERS.responder,
        full_name: 'BDRRMC Lead Marco D. Santos (Demo Responder)',
        email: 'responder@ilink.demo',
        phone: '+63 917 555 0102',
        purok: 'Purok 2 - Riverside',
        address: 'BDRRMC Command Post, Barangay Labangon, Cebu City',
        avatar_url: null,
        is_active: true,
        is_demo: true,
        created_at: iso(-14 * 86400000),
        updated_at: iso(-14 * 86400000),
      },
      {
        id: LOCAL_USERS.resident,
        full_name: 'Andrea L. Villanueva (Demo Resident)',
        email: 'resident@ilink.demo',
        phone: '+63 917 555 0103',
        purok: 'Purok 3 - Sitio Riverside',
        address: '42 Katipunan St., Purok 3, Cebu City',
        avatar_url: null,
        is_active: true,
        is_demo: true,
        created_at: iso(-10 * 86400000),
        updated_at: iso(-10 * 86400000),
      },
    ],
    user_roles: [
      { id: randomUUID(), user_id: LOCAL_USERS.admin, role: 'admin', created_at: iso(), updated_at: iso() },
      { id: randomUUID(), user_id: LOCAL_USERS.responder, role: 'responder', created_at: iso(), updated_at: iso() },
      { id: randomUUID(), user_id: LOCAL_USERS.resident, role: 'resident', created_at: iso(), updated_at: iso() },
    ],
    barangay_services: [
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
    ],
    announcements: [
      {
        id: randomUUID(),
        author_id: LOCAL_USERS.admin,
        title: '[DEMO] Rainy Season Flood Preparedness & Four-Tier Early Warning Activation',
        summary:
          'Our IoT ultrasonic flood sensor at Kinalumsan River Bridge is active. Review the PAGASA-aligned Advisory, Warning, Danger, and Critical alert thresholds.',
        body: `The Barangay Disaster Risk Reduction and Management Committee (BDRRMC) reminds all residents—especially households in Purok 2 and Purok 3 Riverside—that the I-Link IoT Flood Early Warning Node at Kinalumsan Bridge is transmitting live telemetry every 10 seconds.\n\nTiered Alert Actions:\n• YELLOW (Advisory, ≥50 cm): Monitor I-Link alerts and secure ground-floor valuables.\n• ORANGE (Warning, ≥100 cm): Prepare emergency go-bags, medicines, and documents; assist senior citizens and PWDs.\n• RED (Danger, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to Labangon Elementary School Gymnasium.\n• DARK RED (Critical, ≥200 cm): Mandatory evacuation in progress; contact BDRRMC Rescue or call 911 immediately.`,
        category: 'disaster_preparedness',
        priority: 'urgent',
        is_published: true,
        is_pinned: true,
        published_at: iso(-2 * 86400000),
        expires_at: null,
        is_demo: true,
        created_at: iso(-2 * 86400000),
        updated_at: iso(-2 * 86400000),
      },
      {
        id: randomUUID(),
        author_id: LOCAL_USERS.admin,
        title: '[DEMO] Saturday Bayanihan Canal Declogging & Solid Waste Segregation Drive',
        summary:
          'Join volunteers this Saturday at 6:30 AM at Purok 3 Sitio Riverside to clear drainage waterways identified by I-Link Clean hotspot analytics.',
        body: `I-Link Clean spatial clustering identified recurring drainage blockages along Katipunan Extension and Purok 3 creekside. The Barangay Environment Committee invites residents, SK youth, and student volunteers to register via I-Link Bayanihan.\n\nGloves, sacks, and refreshments will be provided at the assembly point in front of the Barangay Covered Court.`,
        category: 'environment',
        priority: 'important',
        is_published: true,
        is_pinned: false,
        published_at: iso(-86400000),
        expires_at: null,
        is_demo: true,
        created_at: iso(-86400000),
        updated_at: iso(-86400000),
      },
      {
        id: randomUUID(),
        author_id: LOCAL_USERS.admin,
        title: '[DEMO] Free Maternal, Senior & PWD Medical Checkup at Barangay Health Center',
        summary:
          'Free blood pressure screening, maintenance medicine distribution, and prenatal checkups every Wednesday 8:00 AM – 12:00 NN.',
        body: `Bring your Barangay Health Card or valid ID to the Barangay Health Center. Wheelchairs and accessible ramps are available at the main entrance (verified on I-Link Access Map).`,
        category: 'health',
        priority: 'normal',
        is_published: true,
        is_pinned: false,
        published_at: iso(-12 * 3600000),
        expires_at: null,
        is_demo: true,
        created_at: iso(-12 * 3600000),
        updated_at: iso(-12 * 3600000),
      },
    ],
    community_locations: [
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-5 * 86400000),
        updated_at: iso(-5 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-5 * 86400000),
        updated_at: iso(-5 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-5 * 86400000),
        updated_at: iso(-5 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-5 * 86400000),
        updated_at: iso(-5 * 86400000),
      },
      {
        id: randomUUID(),
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
        created_by: LOCAL_USERS.admin,
        created_at: iso(-5 * 86400000),
        updated_at: iso(-5 * 86400000),
      },
    ],
    community_activities: [
      {
        id: act1Id,
        title: '[DEMO] Purok 3 Creekside Drainage Declogging & Clean-Up',
        description:
          'Collaborative waterway clearing and plastic waste recovery prior to heavy monsoon rains. Tools and PPE provided.',
        activity_type: 'environmental',
        is_volunteer_opportunity: true,
        location_text: 'Purok 3 Riverside Footbridge Assembly Area',
        latitude: 10.2934,
        longitude: 123.8839,
        starts_at: iso(3 * 86400000),
        ends_at: iso(3 * 86400000 + 4 * 3600000),
        max_participants: 40,
        status: 'upcoming',
        organizer_id: LOCAL_USERS.admin,
        is_demo: true,
        created_at: iso(-2 * 86400000),
        updated_at: iso(-2 * 86400000),
      },
      {
        id: act2Id,
        title: '[DEMO] Barangay Flood Evacuation Drill & First-Aid Workshop',
        description:
          'Hands-on orientation on I-Link 4-tier flood alerts, evacuation routing for senior citizens/PWDs, and basic life support.',
        activity_type: 'disaster_response',
        is_volunteer_opportunity: true,
        location_text: 'Labangon Community Evacuation Gymnasium',
        latitude: 10.2974,
        longitude: 123.8832,
        starts_at: iso(7 * 86400000),
        ends_at: null,
        max_participants: 60,
        status: 'upcoming',
        organizer_id: LOCAL_USERS.responder,
        is_demo: true,
        created_at: iso(-86400000),
        updated_at: iso(-86400000),
      },
    ],
    volunteer_registrations: [
      {
        id: randomUUID(),
        activity_id: act1Id,
        user_id: LOCAL_USERS.resident,
        status: 'confirmed',
        skills: 'Waste sorting, community coordination',
        notes: 'Demo volunteer registration',
        created_at: iso(-86400000),
        updated_at: iso(-86400000),
      },
    ],
    emergency_reports: [
      {
        id: em1Id,
        reference_code: 'EM-9A41F2B0',
        reporter_id: LOCAL_USERS.resident,
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
        assigned_to: LOCAL_USERS.responder,
        is_demo: true,
        resolved_at: null,
        created_at: iso(-3 * 3600000),
        updated_at: iso(-2 * 3600000),
      },
      {
        id: em2Id,
        reference_code: 'EM-7C18D9E4',
        reporter_id: LOCAL_USERS.resident,
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
        assigned_to: LOCAL_USERS.responder,
        is_demo: true,
        resolved_at: null,
        created_at: iso(-18 * 3600000),
        updated_at: iso(-16 * 3600000),
      },
    ],
    community_reports: [
      {
        id: cr1Id,
        reference_code: 'CR-3E82B110',
        reporter_id: LOCAL_USERS.resident,
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
        assigned_to: LOCAL_USERS.responder,
        is_demo: true,
        resolved_at: null,
        created_at: iso(-24 * 3600000),
        updated_at: iso(-20 * 3600000),
      },
      {
        id: cr2Id,
        reference_code: 'CR-5F19C408',
        reporter_id: LOCAL_USERS.resident,
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
        assigned_to: null,
        is_demo: true,
        resolved_at: null,
        created_at: iso(-8 * 3600000),
        updated_at: iso(-8 * 3600000),
      },
      {
        id: cr3Id,
        reference_code: 'CR-8D04A921',
        reporter_id: LOCAL_USERS.resident,
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
        assigned_to: LOCAL_USERS.responder,
        is_demo: true,
        resolved_at: iso(-12 * 3600000),
        created_at: iso(-48 * 3600000),
        updated_at: iso(-12 * 3600000),
      },
    ],
    report_attachments: [],
    report_updates: [
      {
        id: randomUUID(),
        emergency_report_id: em1Id,
        community_report_id: null,
        author_id: LOCAL_USERS.resident,
        from_status: null,
        to_status: 'submitted',
        note: 'Emergency report submitted by resident.',
        is_internal: false,
        created_at: iso(-3 * 3600000),
        updated_at: iso(-3 * 3600000),
      },
      {
        id: randomUUID(),
        emergency_report_id: em1Id,
        community_report_id: null,
        author_id: LOCAL_USERS.responder,
        from_status: 'submitted',
        to_status: 'responding',
        note: 'BDRRMC rescue team dispatched to Purok 3 footbridge with flotation gear.',
        is_internal: false,
        created_at: iso(-2 * 3600000),
        updated_at: iso(-2 * 3600000),
      },
    ],
    notifications: [
      {
        id: randomUUID(),
        user_id: LOCAL_USERS.admin,
        type: 'emergency_new',
        title: '[CRITICAL] Emergency: Rapidly rising creek water near Purok 3 footbridge',
        body: 'EM-9A41F2B0 · flood at Purok 3 Sitio Riverside Footbridge',
        link: `/app/emergency/${em1Id}`,
        data: { reportId: em1Id },
        is_read: false,
        read_at: null,
        created_at: iso(-3 * 3600000),
        updated_at: iso(-3 * 3600000),
      },
      {
        id: randomUUID(),
        user_id: LOCAL_USERS.resident,
        type: 'report_status',
        title: 'Emergency EM-9A41F2B0: RESPONDING',
        body: 'BDRRMC rescue team dispatched to Purok 3 footbridge with flotation gear.',
        link: `/app/emergency/${em1Id}`,
        data: { reportId: em1Id },
        is_read: false,
        read_at: null,
        created_at: iso(-2 * 3600000),
        updated_at: iso(-2 * 3600000),
      },
    ],
    ai_conversations: [],
    ai_messages: [],
    knowledge_articles: [
      {
        id: randomUUID(),
        topic: 'emergency_procedure',
        question:
          'What do the four I-Link Flood Alert Tiers (Advisory, Warning, Danger, Critical) mean?',
        answer:
          'I-Link uses an ultrasonic IoT sensor measuring water depth and rise velocity (cm/min) every 10 seconds, aligned with PAGASA and NDRRMC protocols:\n• Advisory (Yellow, ≥50 cm): Monitor water levels and prepare household supplies.\n• Warning (Orange, ≥100 cm): Pack go-bags and prepare senior citizens, children, and PWDs.\n• Danger (Red, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to designated evacuation centers.\n• Critical (Dark Red, ≥200 cm): Immediate mandatory evacuation; call 911 or BDRRMC responders.',
        keywords: ['flood', 'tier', 'advisory', 'warning', 'danger', 'critical', 'pagasa', 'sensor', 'water'],
        source: 'BDRRMC Flood Protocol (Verified)',
        is_active: true,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
      {
        id: randomUUID(),
        topic: 'faq',
        question: 'How do I submit an emergency or community cleanliness report on I-Link?',
        answer:
          '1. For immediate hazards (fire, flood, medical, accident), open "I-Link Emergency", choose a category, describe the situation, click the map or "Use my location" to geotag, optionally attach a photo, and submit. BDRRMC responders receive a sub-5-second real-time alert.\n2. For garbage, clogged canals, or sanitation issues, open "I-Link Clean".\n3. You can track status transitions (Submitted → Under Review → Responding → Resolved) in "My Reports".',
        keywords: ['report', 'submit', 'emergency', 'clean', 'garbage', 'status', 'track'],
        source: 'I-Link Platform Guide (Verified)',
        is_active: true,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
      {
        id: randomUUID(),
        topic: 'emergency_procedure',
        question: 'What are the emergency hotlines and evacuation centers in our barangay?',
        answer:
          'National Emergency Hotline: 911 | Bureau of Fire Protection (BFP): 160 | Philippine National Police (PNP): 117 | Barangay BDRRMC Desk: (032) 261-4401. Our primary evacuation center is Labangon Community Evacuation Gymnasium (Katipunan St., capacity 450, PWD-accessible).',
        keywords: ['hotline', '911', 'evacuation', 'phone', 'contact', 'fire', 'police', 'rescue'],
        source: 'Barangay Emergency Directory (Verified)',
        is_active: true,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-7 * 86400000),
      },
    ],
    flood_sensors: [
      {
        id: sensorId,
        name: 'Node #1 — Kinalumsan River Bridge (Demo IoT)',
        location_text: 'Purok 3 Sitio Riverside Footbridge, Cebu City',
        latitude: 10.2932,
        longitude: 123.8842,
        device_key_hash: createHash('sha256')
          .update(process.env.FLOOD_DEVICE_KEY || 'ilink_demo_kinalumsan_sensor_key_2026')
          .digest('hex'),
        sensor_height_cm: 400,
        advisory_cm: 50,
        warning_cm: 100,
        danger_cm: 150,
        critical_cm: 200,
        rapid_rise_cm_min: 2.0,
        current_tier: 'advisory',
        last_depth_cm: 62,
        last_rise_cm_min: 1.2,
        last_reading_at: iso(-60000),
        is_active: true,
        is_demo: true,
        created_at: iso(-7 * 86400000),
        updated_at: iso(-60000),
      },
    ],
    sensor_readings: [28, 32, 36, 42, 48, 53, 58, 62].map((depth, idx, arr) => ({
      id: idx + 1,
      sensor_id: sensorId,
      distance_cm: 400 - depth,
      depth_cm: depth,
      rise_cm_min: idx === 0 ? 0 : Number(((depth - arr[idx - 1]) / 2).toFixed(2)),
      tier: depth >= 50 ? 'advisory' : 'normal',
      recorded_at: iso(-(arr.length - idx) * 120000),
      created_at: iso(-(arr.length - idx) * 120000),
    })),
    flood_alerts: [
      {
        id: randomUUID(),
        sensor_id: sensorId,
        tier: 'advisory',
        previous_tier: 'normal',
        depth_cm: 53,
        rise_cm_min: 1.25,
        message:
          '[DEMO YELLOW ADVISORY] Node #1 — Kinalumsan River Bridge water depth reached 53 cm. Monitor updates closely.',
        created_at: iso(-360000),
        updated_at: iso(-360000),
      },
    ],
    storage_files: [],
  };
}

class LocalQueryBuilder {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private upsertConflict = 'id';
  private filters: Array<(row: Row) => boolean> = [];
  private sorts: Array<{ col: string; asc: boolean }> = [];
  private limitNum: number | null = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private headOnly = false;
  private countExact = false;

  constructor(
    private readonly store: LocalStore,
    private readonly table: string,
  ) {}

  select(_cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.head) this.headOnly = true;
    if (opts?.count === 'exact') this.countExact = true;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    if (opts?.onConflict) this.upsertConflict = opts.onConflict;
    return this;
  }

  update(patch: Row) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push((r) => r[col] > val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push((r) => r[col] >= val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((r) => set.has(r[col]));
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) {
      this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    }
    return this;
  }

  or(expr: string) {
    const clauses = expr.split(',').map((c) => c.trim());
    this.filters.push((r) =>
      clauses.some((c) => {
        if (c.endsWith('.is.null')) {
          const col = c.replace('.is.null', '');
          return r[col] === null || r[col] === undefined;
        }
        const gtIdx = c.indexOf('.gt.');
        if (gtIdx !== -1) {
          const col = c.slice(0, gtIdx);
          const val = c.slice(gtIdx + 4);
          return r[col] > val;
        }
        const ilikeIdx = c.indexOf('.ilike.');
        if (ilikeIdx !== -1) {
          const col = c.slice(0, ilikeIdx);
          const needle = c.slice(ilikeIdx + 7).replace(/^%|%$/g, '').toLowerCase();
          return String(r[col] ?? '').toLowerCase().includes(needle);
        }
        return true;
      }),
    );
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitNum = n;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private hydrateRelations(row: Row): Row {
    const copy = { ...row };
    const profiles = this.store.table('profiles');
    const findProfile = (id: string | null | undefined) => {
      if (!id) return null;
      const p = profiles.find((x) => x.id === id);
      return p
        ? { id: p.id, full_name: p.full_name, email: p.email, phone: p.phone, purok: p.purok }
        : null;
    };

    if (this.table === 'emergency_reports' || this.table === 'community_reports') {
      copy.reporter = findProfile(copy.reporter_id);
      copy.assignee = findProfile(copy.assigned_to);
    } else if (this.table === 'report_updates' || this.table === 'announcements') {
      copy.author = findProfile(copy.author_id);
    } else if (this.table === 'community_activities') {
      copy.organizer = findProfile(copy.organizer_id);
    } else if (this.table === 'volunteer_registrations') {
      copy.user = findProfile(copy.user_id);
      const act = this.store.table('community_activities').find((a) => a.id === copy.activity_id);
      copy.activity = act
        ? {
            id: act.id,
            title: act.title,
            starts_at: act.starts_at,
            ends_at: act.ends_at,
            location_text: act.location_text,
            status: act.status,
            activity_type: act.activity_type,
          }
        : null;
    } else if (this.table === 'flood_alerts') {
      const s = this.store.table('flood_sensors').find((x) => x.id === copy.sensor_id);
      copy.sensor = s ? { id: s.id, name: s.name, location_text: s.location_text } : null;
    }
    return copy;
  }

  private execute(): { data: any; error: any; count?: number } {
    const rows = this.store.table(this.table);
    const nowIso = new Date().toISOString();

    if (this.op === 'insert') {
      const inserted: Row[] = [];
      for (const raw of this.payload as Row[]) {
        const nextId =
          raw.id ??
          (this.table === 'sensor_readings'
            ? rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1
            : randomUUID());
        const row: Row = {
          id: nextId,
          created_at: raw.created_at ?? nowIso,
          updated_at: raw.updated_at ?? nowIso,
          ...raw,
        };
        if (this.table === 'emergency_reports' && !row.reference_code) {
          row.reference_code = 'EM-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
        }
        if (this.table === 'community_reports' && !row.reference_code) {
          row.reference_code = 'CR-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
        }
        if (this.table === 'profiles' && row.is_active === undefined) row.is_active = true;
        if (row.is_demo === undefined) row.is_demo = false;
        rows.push(row);
        inserted.push(this.hydrateRelations(row));
      }
      this.store.save();
      if (this.singleMode !== 'none') return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    if (this.op === 'upsert') {
      const keys = this.upsertConflict.split(',').map((k) => k.trim());
      const out: Row[] = [];
      for (const raw of this.payload as Row[]) {
        const existing = rows.find((r) => keys.every((k) => r[k] === raw[k]));
        if (existing) {
          Object.assign(existing, raw, { updated_at: nowIso });
          out.push(this.hydrateRelations(existing));
        } else {
          const created: Row = {
            id: raw.id ?? randomUUID(),
            created_at: nowIso,
            updated_at: nowIso,
            ...raw,
          };
          rows.push(created);
          out.push(this.hydrateRelations(created));
        }
      }
      this.store.save();
      if (this.singleMode !== 'none') return { data: out[0] ?? null, error: null };
      return { data: out, error: null };
    }

    const matched = rows.filter((r) => this.filters.every((fn) => fn(r)));

    if (this.op === 'update') {
      for (const r of matched) {
        Object.assign(r, this.payload, { updated_at: nowIso });
      }
      this.store.save();
      const hydrated = matched.map((r) => this.hydrateRelations(r));
      if (this.singleMode === 'single') {
        if (!hydrated[0]) return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
        return { data: hydrated[0], error: null };
      }
      if (this.singleMode === 'maybeSingle') return { data: hydrated[0] ?? null, error: null };
      return { data: hydrated, error: null };
    }

    if (this.op === 'delete') {
      const keep = rows.filter((r) => !this.filters.every((fn) => fn(r)));
      this.store.replaceTable(this.table, keep);
      this.store.save();
      return { data: matched, error: null };
    }

    // SELECT
    const totalCount = matched.length;
    if (this.headOnly) {
      return { data: null, error: null, count: totalCount };
    }

    const sorted = [...matched];
    for (let i = this.sorts.length - 1; i >= 0; i--) {
      const { col, asc } = this.sorts[i];
      sorted.sort((a, b) => {
        if (a[col] === b[col]) return 0;
        return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1);
      });
    }

    const sliced = this.limitNum !== null ? sorted.slice(0, this.limitNum) : sorted;
    const hydrated = sliced.map((r) => this.hydrateRelations(r));

    if (this.singleMode === 'single') {
      if (!hydrated[0]) return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
      return { data: hydrated[0], error: null, count: totalCount };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: hydrated[0] ?? null, error: null, count: totalCount };
    }
    return { data: hydrated, error: null, count: totalCount };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const res = this.execute();
      return Promise.resolve(res).then(onfulfilled, onrejected);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected);
    }
  }
}

export class LocalStore {
  private readonly filePath: string;
  private data: Record<string, Row[]>;

  constructor() {
    this.filePath = path.resolve(process.cwd(), '.local-db.json');
    if (fs.existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch {
        this.data = defaultStore();
        this.save();
      }
    } else {
      this.data = defaultStore();
      this.save();
    }
  }

  table(name: string): Row[] {
    if (!this.data[name]) this.data[name] = [];
    return this.data[name];
  }

  replaceTable(name: string, rows: Row[]) {
    this.data[name] = rows;
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch {
      // ignore read-only FS errors
    }
  }

  from(table: string) {
    return new LocalQueryBuilder(this, table);
  }

  login(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.table('auth_users').find(
      (u) => String(u.email).toLowerCase() === cleanEmail && u.password === password,
    );
    if (!user) return null;
    const token = `local_${Buffer.from(JSON.stringify({ sub: user.id, email: user.email })).toString('base64url')}`;
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata ?? {},
      },
    };
  }

  readonly auth = {
    getUser: async (token: string) => {
      if (!token.startsWith('local_')) {
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }
      try {
        const payload = JSON.parse(Buffer.from(token.slice(6), 'base64url').toString('utf8'));
        const user = this.table('auth_users').find((u) => u.id === payload.sub);
        if (!user) return { data: { user: null }, error: { message: 'User not found' } };
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.user_metadata ?? {},
            },
          },
          error: null,
        };
      } catch {
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }
    },
    admin: {
      listUsers: async () => ({
        data: { users: this.table('auth_users') },
        error: null,
      }),
      createUser: async (params: {
        email: string;
        password?: string;
        user_metadata?: Record<string, unknown>;
      }) => {
        const email = params.email.trim().toLowerCase();
        const exists = this.table('auth_users').find((u) => u.email.toLowerCase() === email);
        if (exists) {
          return { data: { user: null }, error: { message: 'User already registered' } };
        }
        const user = {
          id: randomUUID(),
          email,
          password: params.password ?? 'ILinkDemo2026!',
          user_metadata: params.user_metadata ?? {},
        };
        this.table('auth_users').push(user);
        this.save();
        return { data: { user }, error: null };
      },
      updateUserById: async (id: string, patch: any) => {
        const user = this.table('auth_users').find((u) => u.id === id);
        if (user) {
          if (patch.password) user.password = patch.password;
          if (patch.user_metadata) user.user_metadata = patch.user_metadata;
          this.save();
        }
        return { data: { user }, error: null };
      },
    },
  };

  readonly storage = {
    listBuckets: async () => ({
      data: [{ id: 'report-attachments', name: 'report-attachments', public: false }],
      error: null,
    }),
    from: (_bucket: string) => ({
      upload: async (storagePath: string, buffer: Buffer, opts?: { contentType?: string }) => {
        const dataUrl = `data:${opts?.contentType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
        this.table('storage_files').push({ path: storagePath, dataUrl });
        this.save();
        return { data: { path: storagePath }, error: null };
      },
      createSignedUrl: async (storagePath: string, _ttl: number) => {
        const found = this.table('storage_files').find((f) => f.path === storagePath);
        return { data: { signedUrl: found?.dataUrl ?? null }, error: null };
      },
    }),
  };
}
