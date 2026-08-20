// Dummy data for demo/UI purposes only.
// Replace with live calls into Microsoft Fabric / the Delivery Activities Tracker
// data model once the API layer is wired up. Nothing here should be treated as real.

import type {
  KpiMetric,
  NavItem,
} from "@/lib/types";

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "analytics" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

// Default KPI values (global totals — shown when no user-specific data is available)
const defaultKpiMetrics: KpiMetric[] = [
  { id: "sessions", label: "Total Sessions", value: "42", delta: "", trend: "flat", icon: "sessions" },
  { id: "completed", label: "Completed Sessions", value: "38", delta: "", trend: "flat", icon: "completed" },
  { id: "hours", label: "Delivery Hours", value: "510", delta: "", trend: "flat", icon: "hours" },
  { id: "learners", label: "Learners", value: "2,153", delta: "", trend: "flat", icon: "learners" },
  { id: "enquiries", label: "Total Enquiries", value: "71", delta: "", trend: "flat", icon: "enquiries" },
];

// Per-user KPI data (static — matches Power BI RLS-filtered values)
const userKpiData: Record<string, KpiMetric[]> = {
  harish: [
    { id: "sessions", label: "Total Sessions", value: "37", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "33", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "466", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,796", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "65", delta: "", trend: "flat", icon: "enquiries" },
  ],
  ram: [
    { id: "sessions", label: "Total Sessions", value: "37", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "33", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "466", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,796", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "65", delta: "", trend: "flat", icon: "enquiries" },
  ],
  saurabh: [
    { id: "sessions", label: "Total Sessions", value: "37", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "33", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "466", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,796", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "65", delta: "", trend: "flat", icon: "enquiries" },
  ],
  sricharan: [
    { id: "sessions", label: "Total Sessions", value: "37", delta: "", trend: "flat", icon: "sessions" },
    { id: "completed", label: "Completed Sessions", value: "33", delta: "", trend: "flat", icon: "completed" },
    { id: "hours", label: "Delivery Hours", value: "466", delta: "", trend: "flat", icon: "hours" },
    { id: "learners", label: "Learners", value: "1,796", delta: "", trend: "flat", icon: "learners" },
    { id: "enquiries", label: "Total Enquiries", value: "65", delta: "", trend: "flat", icon: "enquiries" },
  ],
};

// Returns KPI metrics for a given email address, or global defaults
export function getKpiMetricsForUser(identifier?: string | null): KpiMetric[] {
  if (!identifier) return defaultKpiMetrics;
  const lower = identifier.toLowerCase();
  // Match by email local-part OR name
  const key = Object.keys(userKpiData).find((k) => lower.startsWith(k) || lower.includes(k));
  return key && userKpiData[key] ? userKpiData[key]! : defaultKpiMetrics;
}


