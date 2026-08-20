// Domain types for the GSI Analytics Portal.
// These model the shape of data that will eventually come from Microsoft Fabric /
// the Delivery Activities Tracker, not just the dummy fixtures in data/dummyData.ts.

export type TrendDirection = "up" | "down" | "flat";

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: TrendDirection;
  icon: KpiIconName;
  /** True when `value` comes from the live Power BI query (see LiveKpiGrid). */
  live?: boolean;
}

export type KpiIconName =
  | "enquiries"
  | "sessions"
  | "completed"
  | "upcoming"
  | "ongoing"
  | "postponed"
  | "cancelled"
  | "hours"
  | "learners"
  | "feedback";

export type NavIconName = "dashboard" | "analytics" | "settings";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
}
