"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Maximize2, RefreshCw, AlertTriangle } from "lucide-react";
// Type-only import — erased at compile time, so it doesn't pull the runtime
// package (and its browser-global references) into the server bundle.
import type { models } from "powerbi-client";

// powerbi-client touches browser globals (`self`/`window`) at import time, so it
// can't be imported at module scope in a component that gets server-prerendered.
// Load it client-side only.
const PowerBIEmbed = dynamic(() => import("powerbi-client-react").then((m) => m.PowerBIEmbed), {
  ssr: false,
});

/**
 * PowerBIContainer
 * ------------------------------------------------------------------
 * Secure ("App Owns Data") embed of a Microsoft Fabric / Power BI
 * report. On mount, it POSTs to /api/powerbi-embed-token, which uses
 * a service-principal to fetch a short-lived embed token server-side
 * (see that route for the one-time Azure/Power BI setup). The token
 * and report are then handed to the official `powerbi-client-react`
 * SDK — no raw iframe, so drill-through, filters, and bookmarks all
 * work as they would inside Power BI Service.
 *
 * If POWERBI_WORKSPACE_ID / POWERBI_REPORT_ID aren't configured yet
 * (or the token request fails), this falls back to the static
 * placeholder so the rest of the app still renders cleanly.
 *
 * Pass `workspaceId` / `reportId` explicitly to embed a specific
 * report (e.g. a different one per page); otherwise the API route's
 * env-var defaults are used.
 * ------------------------------------------------------------------
 */

interface EmbedInfo {
  embedUrl: string;
  reportId: string;
  embedToken: string;
}

export default function PowerBIContainer({
  title = "GSI Delivery Performance",
  workspaceId,
  reportId,
  height = 480,
}: {
  title?: string;
  workspaceId?: string;
  reportId?: string;
  height?: number;
}) {
  const [embed, setEmbed] = useState<EmbedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/powerbi-embed-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reportId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load embed token.");
      setEmbed(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
      setEmbed(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, reportId]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return (
    <div className="bg-white rounded-card border border-surface-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <p className="text-sm font-semibold text-ink">{title}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Refresh report"
            onClick={fetchToken}
            className="h-7 w-7 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-hover"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            aria-label="Expand report"
            className="h-7 w-7 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-hover"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ height }} className="relative">
        {embed ? (
          <PowerBIEmbed
            embedConfig={
              {
                type: "report",
                id: embed.reportId,
                embedUrl: embed.embedUrl,
                accessToken: embed.embedToken,
                tokenType: 1, // models.TokenType.Embed
                settings: {
                  panes: { filters: { visible: false }, pageNavigation: { visible: true } },
                  background: 1, // models.BackgroundType.Transparent
                },
              } as models.IReportEmbedConfiguration
            }
            cssClassName="w-full h-full"
          />
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-status-dangerBg flex items-center justify-center">
              <AlertTriangle size={20} className="text-status-danger" />
            </div>
            <p className="text-sm font-medium text-ink-subtle">Couldn&rsquo;t load the report</p>
            <p className="text-xs text-ink-disabled max-w-md">{error}</p>
            <p className="text-[11px] text-ink-disabled">
              Check POWERBI_WORKSPACE_ID / POWERBI_REPORT_ID and service-principal workspace access.
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,#FAFAF9,#FAFAF9_10px,#F3F2F1_10px,#F3F2F1_20px)]">
            <div className="h-12 w-12 rounded-full bg-primary-tint flex items-center justify-center">
              <BarChart3 size={22} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-ink-subtle">
              {loading ? "Loading report…" : "Report not configured"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
