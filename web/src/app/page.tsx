import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  Building2,
  HeartHandshake,
  Leaf,
  MapPin,
  Megaphone,
  PhoneCall,
  ShieldCheck,
  Waves,
} from 'lucide-react';

const MODULES = [
  {
    name: 'I-Link AI Assistant',
    desc: 'Verified answers from barangay ordinances, services, evacuation centers, and procedures.',
    icon: Bot,
    color: 'bg-blue-50 text-blue-700',
  },
  {
    name: 'I-Link Emergency',
    desc: 'Rapid incident reporting with GPS pinning, photo evidence, and AI priority triage.',
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-700',
  },
  {
    name: 'IoT Flood Early Warning',
    desc: 'Real-time ultrasonic water-level telemetry with 4-tier PAGASA/NDRRMC flood alerts.',
    icon: Waves,
    color: 'bg-teal-50 text-teal-700',
  },
  {
    name: 'I-Link Clean',
    desc: 'Track sanitation, blocked drainage, and solid waste concerns across every purok.',
    icon: Leaf,
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    name: 'I-Link Access',
    desc: 'Official barangay advisories, urgent alerts, and public announcements.',
    icon: Megaphone,
    color: 'bg-amber-50 text-amber-800',
  },
  {
    name: 'Community GIS Map',
    desc: 'Interactive OpenStreetMap view of evacuation centers, health clinics, flood sensors, and reports.',
    icon: MapPin,
    color: 'bg-indigo-50 text-indigo-700',
  },
  {
    name: 'I-Link Bayanihan',
    desc: 'Join community cleanups, disaster drills, and volunteer programs.',
    icon: HeartHandshake,
    color: 'bg-purple-50 text-purple-700',
  },
  {
    name: 'Barangay Services Guide',
    desc: 'Complete requirements, fees, and step-by-step procedures for clearances and permits.',
    icon: Building2,
    color: 'bg-slate-100 text-slate-700',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Emergency Strip */}
      <div className="bg-[#DC2626] text-white px-4 py-2 text-xs font-medium flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-3.5 w-3.5" />
          <span>In immediate danger? Call 911 · BFP 160 · PNP 117</span>
        </div>
        <Link href="/login" className="underline font-semibold">
          Sign in to report an emergency →
        </Link>
      </div>

      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E40AF] text-white font-bold">
              IL
            </span>
            <div>
              <span className="font-bold text-base text-slate-900 block leading-none">
                I-Link
              </span>
              <span className="text-xs text-slate-500">
                Community Intelligence &amp; Resilience Platform
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E3A8A]"
            >
              Register as Resident
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1E40AF]">
              <ShieldCheck className="h-4 w-4" />
              Philippine Barangay Digital Governance &amp; DRRM
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
              Connected, Resilient &amp; Responsive Barangays with{' '}
              <span className="text-[#1E40AF]">I-Link</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              A unified platform connecting residents, barangay responders, and administrators
              through real-time emergency dispatch, IoT ultrasonic flood sensors, rule-based
              community intelligence, and verified AI civic guidance.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-xl bg-[#1E40AF] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1E3A8A]"
              >
                Launch I-Link Portal
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Create Resident Account
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Live Capabilities
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Socket.IO Realtime
                </span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-white p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-red-700">AI Priority Triage</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Automatically scores emergency &amp; community reports by hazard category,
                    life-safety keywords, affected headcount, and purok clustering.
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-teal-700">
                    PAGASA / NDRRMC 4-Tier Flood Alerts
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Monitors waterway depth (cm) and rise velocity (cm/min), escalating alerts
                    instantly when rapid rise thresholds are crossed.
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-blue-700">
                    Grounded Barangay AI Assistant
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Answers resident questions using verified barangay services, evacuation
                    centers, and advisories with transparent source badges.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 flex-1">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900">Integrated Barangay Modules</h2>
          <p className="text-sm text-slate-600 mt-1">
            Designed for residents, barangay tanods/responders, and barangay administrators.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.name}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-blue-300 transition-colors"
              >
                <div>
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${m.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">{m.name}</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
        I-Link · AI-Powered Community Intelligence &amp; Resilience Platform
      </footer>
    </div>
  );
}
