"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import KpiCard from "@/components/ui/KpiCard";
import KpiDetailModal from "@/components/ui/KpiDetailModal";
import type { KpiMetric } from "@/lib/types";

/**
 * KPI grid backed by live Power BI data.
 * ---------------------------------------------------------------------------
 * Fetches real values from /api/report-data (queried as the signed-in user)
 * and overlays them on the base metrics. Each card falls back to its sample
 * value independently when the live query for it isn't available yet (e.g.
 * Dataset.Read.All consent pending, or a KPI whose DAX needs refining).
 */
export default function LiveKpiGrid({ metrics }: { metrics: KpiMetric[] }) {
  const [liveValues, setLiveValues] = useState<Record<string, number> | null>(null);
  const [detail, setDetail] = useState<KpiMetric | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/report-data?kpi=all")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { live?: boolean; values?: Record<string, number> }) => {
        if (!cancelled && data.live && data.values) setLiveValues(data.values);
      })
      .catch(() => {
        // Keep sample data — the user may not have granted Dataset.Read.All yet.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = metrics.map((metric) => {
    const live = liveValues?.[metric.id];
    if (live == null) return metric;
    return {
      ...metric,
      value: live.toLocaleString("en-IN"),
      live: true,
    };
  });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {resolved.map((metric) => (
          <KpiCard
            key={metric.id}
            metric={metric}
            onClick={metric.id === "sessions" ? () => setDetail(metric) : undefined}
          />
        ))}
      </div>

      <AnimatePresence>
        {detail && (
          <KpiDetailModal metric={detail} metrics={metrics} onClose={() => setDetail(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
