-- =====================================================================
-- I-Link MVP — Declarative SQL Seed (Public Directory, GIS, Knowledge Base, IoT)
-- Can be run directly in the Supabase SQL Editor after migrations or
-- automatically by `npx supabase db reset`.
-- (For Auth demo accounts admin/responder/resident@ilink.demo, run `cd api && npm run seed`.)
-- =====================================================================

-- 1. Barangay Services Directory (I-Link Barangay Services)
insert into public.barangay_services
  (name, category, description, requirements, procedure_steps, fee, processing_time, office, office_hours, contact_number, contact_email, is_active)
values
  (
    'Barangay Clearance',
    'certificate',
    'Official certification confirming good moral standing and residency in the barangay for employment, business, or ID applications.',
    array[
      'Valid government-issued ID or school ID',
      'Community Tax Certificate (Cedula) for the current year',
      'Purok Clearance or Certificate of Residency signed by Purok Leader'
    ],
    array[
      'Present requirements at Window 1 (Records & Verification Desk).',
      'Pay the corresponding clearance fee at Window 2 (Barangay Treasurer).',
      'Have your photo and signature captured at Window 3.',
      'Claim the signed and dry-sealed Barangay Clearance (15–20 minutes).'
    ],
    'PHP 50.00 (Free for first-time jobseekers under RA 11261)',
    '15–20 minutes',
    'Barangay Hall — Ground Floor, Records Section',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4401',
    'records@barangay-ilink.gov.ph',
    true
  ),
  (
    'Certificate of Indigency',
    'certificate',
    'Issued to qualified low-income residents seeking medical, educational, burial, or legal assistance from DSWD, PCSO, or scholarship programs.',
    array[
      'Valid ID or voter certification of applicant or immediate family member',
      'Brief written request or hospital bill / scholarship endorsement',
      'Purok Leader attestation of household status'
    ],
    array[
      'Submit requirements at the Social Services Desk (Window 1).',
      'Undergo brief verification interview with the Barangay Social Worker.',
      'Receive signed Certificate of Indigency from the Punong Barangay office.'
    ],
    'Free (PHP 0.00)',
    '15 minutes',
    'Barangay Hall — Social Services Desk',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4402',
    'socialservices@barangay-ilink.gov.ph',
    true
  ),
  (
    'Barangay Business Permit Clearance',
    'permit',
    'Mandatory barangay endorsement required for new business registration or annual renewal with the City Business Permits and Licensing Office (BPLO).',
    array[
      'DTI Business Name Registration (sole proprietorship) or SEC Registration',
      'Contract of Lease or Transfer Certificate of Title for business address',
      'Previous year Barangay Business Clearance (for renewals)'
    ],
    array[
      'Submit documents at Window 2 (Business & Treasury Section).',
      'Pay barangay business clearance fee based on business classification.',
      'Release of signed Barangay Business Clearance with official receipt.'
    ],
    'PHP 200.00 – PHP 1,000.00 (based on capital classification)',
    '30 minutes',
    'Barangay Hall — Treasury & Licensing Section',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4403',
    'treasury@barangay-ilink.gov.ph',
    true
  ),
  (
    'Katarungang Pambarangay (Lupong Tagapamayapa) Mediation',
    'legal',
    'Community dispute resolution and mediation service prior to court filing in accordance with the Local Government Code (RA 7160).',
    array[
      'Valid ID of complainant',
      'Complete name and address of respondent within the barangay',
      'Written narrative of complaint and relief sought'
    ],
    array[
      'File complaint form at the Lupong Tagapamayapa Desk.',
      'Receive scheduled summons date for Punong Barangay mediation.',
      'Attend mediation/conciliation conferences as scheduled.'
    ],
    'Free (PHP 0.00)',
    '1–3 scheduled mediation hearings',
    'Barangay Hall — 2nd Floor, Lupon Session Room',
    'Monday to Friday, 8:00 AM – 5:00 PM',
    '(032) 261-4404',
    'lupon@barangay-ilink.gov.ph',
    true
  )
on conflict (name) do update set
  description = excluded.description,
  requirements = excluded.requirements,
  procedure_steps = excluded.procedure_steps,
  fee = excluded.fee,
  processing_time = excluded.processing_time,
  office = excluded.office,
  office_hours = excluded.office_hours,
  contact_number = excluded.contact_number,
  contact_email = excluded.contact_email,
  is_active = excluded.is_active;

-- 2. Verified Knowledge Base Articles (I-Link AI)
delete from public.knowledge_articles where source in (
  'BDRRMC Flood Protocol (Verified)',
  'I-Link Platform Guide (Verified)',
  'Barangay Emergency Directory (Verified)'
);

insert into public.knowledge_articles (topic, question, answer, keywords, source, is_active)
values
  (
    'emergency_procedure',
    'What do the four I-Link Flood Alert Tiers (Advisory, Warning, Danger, Critical) mean?',
    E'I-Link uses an ultrasonic IoT sensor measuring water depth and rise velocity (cm/min) every 10 seconds, aligned with PAGASA and NDRRMC protocols:\n• Advisory (Yellow, ≥50 cm): Monitor water levels and prepare household supplies.\n• Warning (Orange, ≥100 cm): Pack go-bags and prepare senior citizens, children, and PWDs.\n• Danger (Red, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to designated evacuation centers.\n• Critical (Dark Red, ≥200 cm): Immediate mandatory evacuation; call 911 or BDRRMC responders.',
    array['flood', 'tier', 'advisory', 'warning', 'danger', 'critical', 'pagasa', 'sensor', 'water'],
    'BDRRMC Flood Protocol (Verified)',
    true
  ),
  (
    'faq',
    'How do I submit an emergency or community cleanliness report on I-Link?',
    E'1. For immediate hazards (fire, flood, medical, accident), open "I-Link Emergency", choose a category, describe the situation, click the map or "Use my location" to geotag, optionally attach a photo, and submit. BDRRMC responders receive a sub-5-second real-time alert.\n2. For garbage, clogged canals, or sanitation issues, open "I-Link Clean".\n3. You can track status transitions (Submitted → Under Review → Responding → Resolved) in "My Reports".',
    array['report', 'submit', 'emergency', 'clean', 'garbage', 'status', 'track'],
    'I-Link Platform Guide (Verified)',
    true
  ),
  (
    'emergency_procedure',
    'What are the emergency hotlines and evacuation centers in our barangay?',
    'National Emergency Hotline: 911 | Bureau of Fire Protection (BFP): 160 | Philippine National Police (PNP): 117 | Barangay BDRRMC Desk: (032) 261-4401. Our primary evacuation center is Labangon Community Evacuation Gymnasium (Katipunan St., capacity 450, PWD-accessible).',
    array['hotline', '911', 'evacuation', 'phone', 'contact', 'fire', 'police', 'rescue'],
    'Barangay Emergency Directory (Verified)',
    true
  );

-- 3. Community GIS Locations (I-Link Community Map)
delete from public.community_locations where is_demo = true;

insert into public.community_locations
  (name, category, description, address, latitude, longitude, contact_number, capacity, is_accessible, is_public, is_demo)
values
  (
    'Barangay Command & Administrative Hall (Demo)',
    'barangay_hall',
    '24/7 BDRRMC operations desk, barangay clearances, and Lupon office.',
    'N. Bacalso Ave., Cebu City',
    10.2948, 123.8814, '(032) 261-4401', 120, true, true, true
  ),
  (
    'Labangon Community Evacuation Gymnasium (Demo)',
    'evacuation_center',
    'Primary flood and typhoon evacuation center with generator backup, water station, and PWD accessibility ramp.',
    'Katipunan St., Cebu City',
    10.2974, 123.8832, '(032) 261-4490', 450, true, true, true
  ),
  (
    'Barangay Primary Health & Birthing Center (Demo)',
    'health_center',
    'First-aid triage, maternal care, immunization, and emergency stabilization.',
    'Tres de Abril St., Cebu City',
    10.2959, 123.8798, '(032) 261-4412', 60, true, true, true
  ),
  (
    'Cebu Institute of Technology – University Campus Assembly Point (Demo)',
    'school',
    'Partner academic institution and secondary emergency assembly zone.',
    'N. Bacalso Ave., Cebu City',
    10.2945, 123.8811, '(032) 261-7741', 800, true, true, true
  ),
  (
    'Kinalumsan Creek Low-Lying Flood Hazard Zone (Demo)',
    'flood_prone_area',
    'Historical flash-flood zone monitored by Ultrasonic IoT Node #1. Pre-emptive evacuation triggered at Danger tier.',
    'Purok 3 Sitio Riverside, Cebu City',
    10.2932, 123.8842, '(032) 261-4401', null, false, true, true
  );

-- 4. Official Announcements (I-Link Access)
delete from public.announcements where is_demo = true;

insert into public.announcements
  (title, summary, body, category, priority, is_published, is_pinned, is_demo)
values
  (
    '[DEMO] Rainy Season Flood Preparedness & Four-Tier Early Warning Activation',
    'Our IoT ultrasonic flood sensor at Kinalumsan River Bridge is active. Review the PAGASA-aligned Advisory, Warning, Danger, and Critical alert thresholds.',
    E'The Barangay Disaster Risk Reduction and Management Committee (BDRRMC) reminds all residents—especially households in Purok 2 and Purok 3 Riverside—that the I-Link IoT Flood Early Warning Node at Kinalumsan Bridge is transmitting live telemetry every 10 seconds.\n\nTiered Alert Actions:\n• YELLOW (Advisory, ≥50 cm): Monitor I-Link alerts and secure ground-floor valuables.\n• ORANGE (Warning, ≥100 cm): Prepare emergency go-bags, medicines, and documents; assist senior citizens and PWDs.\n• RED (Danger, ≥150 cm or rapid rise ≥2 cm/min): Pre-emptive evacuation to Labangon Elementary School Gymnasium.\n• DARK RED (Critical, ≥200 cm): Mandatory evacuation in progress; contact BDRRMC Rescue or call 911 immediately.',
    'disaster_preparedness', 'urgent', true, true, true
  ),
  (
    '[DEMO] Saturday Bayanihan Canal Declogging & Solid Waste Segregation Drive',
    'Join volunteers this Saturday at 6:30 AM at Purok 3 Sitio Riverside to clear drainage waterways identified by I-Link Clean hotspot analytics.',
    E'I-Link Clean spatial clustering identified recurring drainage blockages along Katipunan Extension and Purok 3 creekside. The Barangay Environment Committee invites residents, SK youth, and student volunteers to register via I-Link Bayanihan.\n\nGloves, sacks, and refreshments will be provided at the assembly point in front of the Barangay Covered Court.',
    'environment', 'important', true, false, true
  );

-- 5. IoT Flood Sensor Node #1 (device key: ilink_demo_kinalumsan_sensor_key_2026)
insert into public.flood_sensors
  (name, location_text, latitude, longitude, device_key_hash, sensor_height_cm, advisory_cm, warning_cm, danger_cm, critical_cm, rapid_rise_cm_min, current_tier, last_depth_cm, last_rise_cm_min, last_reading_at, is_active, is_demo)
values
  (
    'Node #1 — Kinalumsan River Bridge (Demo IoT)',
    'Purok 3 Sitio Riverside Footbridge, Cebu City',
    10.2932, 123.8842,
    encode(digest('ilink_demo_kinalumsan_sensor_key_2026', 'sha256'), 'hex'),
    400, 50, 100, 150, 200, 2.0,
    'advisory', 62, 1.2, now(), true, true
  )
on conflict (device_key_hash) do nothing;
