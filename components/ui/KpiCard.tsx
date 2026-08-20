"use client";

import { motion } from "framer-motion";
import {
  Inbox,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Play,
  PauseCircle,
  XCircle,
  Timer,
  GraduationCap,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { KpiIconName, KpiMetric } from "@/lib/types";

const ICONS: Record<KpiIconName, React.ComponentType<{ size?: number }>> = {
  enquiries: Inbox,
  sessions: CalendarCheck2,
  completed: CheckCircle2,
  upcoming: Clock,
  ongoing: Play,
  postponed: PauseCircle,
  cancelled: XCircle,
  hours: Timer,
  learners: GraduationCap,
  feedback: Star,
};

const TREND_STYLES = {
  up: { color: "text-status-success", Icon: TrendingUp },
  down: { color: "text-status-danger", Icon: TrendingDown },
  flat: { color: "text-ink-subtle", Icon: Minus },
};

export default function KpiCard({
  metric,
  onClick,
}: {
  metric: KpiMetric;
  onClick?: () => void;
}) {
  const Icon = ICONS[metric.icon];
  const trend = TREND_STYLES[metric.trend];
  const TrendIcon = trend.Icon;
  const interactive = Boolean(onClick);

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `View detailed summary for ${metric.label}` : undefined}
      onKeyDown={
        interactive
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`bg-white rounded-card border border-surface-border shadow-card hover:shadow-elevated px-4 py-3.5 ${
        interactive ? "cursor-pointer ring-1 ring-primary/10 border-primary/40 hover:border-primary/60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-md bg-primary-tint flex items-center justify-center text-primary">
          <Icon size={17} />
        </div>
        {metric.live ? (
          <span
            className="flex items-center gap-1.5 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success"
            title="Live from the MS-GSI-Report Power BI model"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-success" />
            </span>
            Live
          </span>
        ) : interactive ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            View details
          </span>
        ) : metric.delta ? (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.color}`}>
            <TrendIcon size={13} />
            {metric.delta}
          </div>
        ) : null}
      </div>
      <p className="text-2xl font-semibold text-ink mt-3 tracking-tight">{metric.value}</p>
      <p className="text-xs text-ink-subtle mt-1">{metric.label}</p>
    </motion.div>
  );
}
