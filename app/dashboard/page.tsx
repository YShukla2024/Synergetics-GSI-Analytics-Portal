import Link from "next/link";
import { BarChart3, CalendarCheck2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LiveKpiGrid from "@/components/ui/LiveKpiGrid";
import type { KpiMetric } from "@/lib/types";
import { auth } from "@/auth";
import { canAccess } from "@/lib/access";

// Per-user KPI data matching Power BI RLS-filtered values
const userKpiData: Record<string, KpiMetric[]> = {
  harish: [
    { id: "sessions", label: "Total Sessions", value: "37", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "33", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "466", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,796", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "65", delta: "", trend: "flat", icon: "enquiries" },
  ],
  saurabh: [
    { id: "sessions", label: "Total Sessions", value: "7", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "6", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "119", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "457", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "26", delta: "", trend: "flat", icon: "enquiries" },
  ],
  sricharan: [
    { id: "sessions", label: "Total Sessions", value: "30", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "27", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "347", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,339", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "39", delta: "", trend: "flat", icon: "enquiries" },
  ],
};

const fallback: KpiMetric[] = [
  { id: "sessions", label: "Total Sessions", value: "42", delta: "", trend: "flat", icon: "sessions" },
  { id: "completed", label: "Completed Sessions", value: "38", delta: "", trend: "flat", icon: "completed" },
  { id: "hours", label: "Delivery Hours", value: "510", delta: "", trend: "flat", icon: "hours" },
  { id: "learners", label: "Learners", value: "2,153", delta: "", trend: "flat", icon: "learners" },
  { id: "enquiries", label: "Total Enquiries", value: "71", delta: "", trend: "flat", icon: "enquiries" },
];

function getMetrics(name?: string | null): KpiMetric[] {
  if (!name) return fallback;
  const lower = name.toLowerCase();
  const key = Object.keys(userKpiData).find((k) => lower.startsWith(k) || lower.includes(k));
  return key && userKpiData[key] ? userKpiData[key]! : fallback;
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "";
  const kpiMetrics = getMetrics(session?.user?.name);
  // Local "viewer" accounts see the dashboard only — hide the analytics CTA.
  const showAnalytics = canAccess(session?.user?.accessLevel, "analyst");

  return (
    <AppShell>
      <Breadcrumb items={[{ label: "GSI Analytics Portal", href: "/dashboard" }, { label: "Dashboard" }]} />

      {/* Hero — GSI × Synergetics landing banner */}
      <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary-dark via-primary to-[#C94A7B] shadow-elevated">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div aria-hidden className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white py-1 pl-1.5 pr-3 ring-1 ring-white/40">
              <img src="/synergetics-logo.png" alt="Synergetics logo" className="h-6 w-auto object-contain" />
              <span className="text-xs font-semibold text-primary-dark">Synergetics</span>
            </span>
            {firstName && (
              <span className="ml-auto inline-flex items-center rounded-pill bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
                Welcome back, {firstName}
              </span>
            )}
          </div>

          <h1 className="mt-5 font-display uppercase tracking-wide text-3xl sm:text-4xl font-semibold text-white">
            GSI Delivery Intelligence
          </h1>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {showAnalytics && (
              <Link
                href="/analytics"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-white text-sm font-semibold text-primary-dark shadow-card transition-colors hover:bg-primary-light"
              >
                <BarChart3 size={16} />
                View Full Analytics
              </Link>
            )}
            <span className="text-xs text-white/70">
              Real-time data · powered by Synergetics
            </span>
          </div>
        </div>
      </section>

      {/* KPI data — the only content on this page besides the hero */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-display uppercase tracking-wide text-lg font-semibold text-ink">Delivery at a Glance</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
            <CalendarCheck2 size={13} />
            Click any card for a detailed summary · values are RLS-scoped per user
          </span>
        </div>
        <LiveKpiGrid metrics={kpiMetrics} />
      </div>
    </AppShell>
  );
}
