"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  X,
  ArrowRight,
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

const DESCRIPTIONS: Record<string, string> = {
  sessions: "All scheduled delivery sessions across the GSI program in FY26, across every status.",
  completed: "Sessions that finished with attendance recorded and the content delivered.",
  ongoing: "Sessions currently in delivery — started but not yet completed.",
  postponed: "Sessions rescheduled to a later date and still to be delivered.",
  cancelled: "Sessions that were cancelled and will not be redelivered.",
  upcoming: "Sessions scheduled ahead but not yet started.",
  hours: "Total instructor delivery hours logged across the program in FY26.",
  learners: "Unique learners who attended at least one delivery session.",
  enquiries: "New delivery enquiries received from partners in FY26.",
  feedback: "Average learner feedback score across completed sessions, out of 5.",
};

const STATUS_ORDER = ["completed", "ongoing", "postponed", "cancelled", "upcoming"] as const;

type StatusId = (typeof STATUS_ORDER)[number];

const STATUS_META: Record<StatusId, { label: string; color: string }> = {
  completed: { label: "Completed", color: "#107C10" },
  ongoing: { label: "On-going", color: "#A52759" },
  postponed: { label: "Postponed", color: "#B06E00" },
  cancelled: { label: "Cancelled", color: "#D13438" },
  upcoming: { label: "Upcoming", color: "#605E5C" },
};

function toNumber(metric?: KpiMetric): number {
  return Number((metric?.value ?? "0").replace(/[^\d.]/g, ""));
}

export default function KpiDetailModal({
  metric,
  metrics,
  onClose,
}: {
  metric: KpiMetric;
  metrics: KpiMetric[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = ICONS[metric.icon];
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const others = metrics.filter((m) => m.id !== metric.id);
  const isSessions = metric.id === "sessions";

  const statusRows = STATUS_ORDER.map((id) => {
    const meta = STATUS_META[id];
    const value = toNumber(byId.get(id));
    return { id, label: meta.label, color: meta.color, value };
  });
  const statusTotal = statusRows.reduce((sum, r) => sum + r.value, 0);
  const share = (v: number) => (statusTotal > 0 ? Math.round((v / statusTotal) * 1000) / 10 : 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${metric.label} — Detailed Summary`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-lg bg-white rounded-card shadow-flyout overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (pinned) */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-primary-tint flex items-center justify-center text-primary shrink-0">
              <Icon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {metric.label} — Detailed Summary
              </p>
              <p className="text-xs text-ink-subtle">FY26 · GSI · All partners</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-hover hover:text-ink transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body (scrolls when taller than the viewport) */}
        <div className="px-5 py-5 space-y-5 overflow-y-auto">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-semibold text-ink tracking-tight">{metric.value}</p>
              <p className="text-xs text-ink-subtle mt-1">{metric.label}</p>
            </div>
            <span className="rounded-pill bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-dark">
              FY26 tracked
            </span>
          </div>

          <p className="text-sm text-ink-subtle leading-relaxed">
            {DESCRIPTIONS[metric.id] ?? "Delivery performance metric for the GSI program in FY26."}
          </p>

          {/* Sessions: status breakdown from the report's real figures */}
          {isSessions && (
            <div className="space-y-3">
              <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-hover" aria-hidden>
                {statusRows
                  .filter((r) => r.value > 0)
                  .map((r) => (
                    <div
                      key={r.id}
                      style={{ width: `${share(r.value)}%`, backgroundColor: r.color }}
                      title={`${r.label}: ${r.value}`}
                    />
                  ))}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {statusRows.map((r) => (
                    <tr key={r.id} className="border-b border-surface-border last:border-0">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2.5 text-ink">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                          {r.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-ink">{r.value}</td>
                      <td className="py-2.5 text-right text-xs text-ink-subtle w-14">{share(r.value)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Related delivery metrics */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-2">
              Related Delivery Metrics
            </p>
            <div className="grid grid-cols-3 gap-2">
              {others.map((m) => {
                const OtherIcon = ICONS[m.icon];
                return (
                  <div
                    key={m.id}
                    className="rounded-md border border-surface-border bg-surface-bg/50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5 text-primary-dark">
                      <OtherIcon size={12} />
                      <span className="text-[10px] text-ink-subtle leading-tight">{m.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-ink mt-1">{m.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer (pinned) */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-surface-border shrink-0">
          <p className="text-[11px] text-ink-disabled leading-snug">
            Values are scoped to your signed-in RLS access — each user sees
            only the programs they are authorized for.
          </p>
          <Link
            href="/analytics"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            Open Analytics
            <ArrowRight size={15} />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
