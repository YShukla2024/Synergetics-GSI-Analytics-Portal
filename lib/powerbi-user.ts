/**
 * Live report-data access as the signed-in user.
 * ---------------------------------------------------------------------------
 * The dashboard KPIs use the service principal to query the Power BI semantic
 * model, passing the user's identity as effectiveIdentity so RLS is enforced.
 * This avoids requiring individual Power BI licenses for each user.
 */

import type { JWT } from "next-auth/jwt";
// JWT is used for user identity (email, name) to apply RLS filtering.

const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";
const AAD_TOKEN_SCOPE = "https://analysis.windows.net/powerbi/api/.default";

/** Short-lived in-memory cache of service principal tokens. */
const spTokenCache = new Map<string, { token: string; expiresAt: number }>();

// Known limitation: Entra ID rotates refresh tokens on every redemption, but
// the session JWT can't be rewritten from a route handler (Auth.js v5). The
// stored token therefore goes stale after ~90 days (or rotation) and the user
// re-signs in to refresh it. Fine for this portal; revisit if sessions outlive
// the rotation window.

/** Cached report metadata so we don't re-fetch it on every KPI request. */
let reportMetaCache: { datasetId: string; fetchedAt: number } | null = null;

/** Gets a service principal access token for Power BI (cached ~55 min). */
async function getServicePrincipalToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET env vars.");
  }

  const cached = spTokenCache.get("sp");
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) return cached.token;

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: AAD_TOKEN_SCOPE,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Service principal token request failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { access_token: string };
  spTokenCache.set("sp", { token: json.access_token, expiresAt: Date.now() + 55 * 60_000 });
  return json.access_token;
}

// RLS is enforced by the Power BI embed (embed token with effective identity).
// The DAX queries run as the service principal WITHOUT effectiveIdentity
// because some RLS filters compare numeric columns with USERNAME() (text),
// causing type mismatches. The dashboard shows global KPIs; the embedded
// Power BI report shows the user's RLS-filtered view.

/** Resolves the workspace's report to its semantic-model (dataset) ID. */
async function getDatasetId(token: string): Promise<string> {
  if (reportMetaCache && reportMetaCache.fetchedAt > Date.now() - 10 * 60_000) {
    return reportMetaCache.datasetId;
  }
  const workspaceId = process.env.POWERBI_WORKSPACE_ID;
  const reportId = process.env.POWERBI_REPORT_ID;
  if (!workspaceId || !reportId) {
    throw new Error("Missing POWERBI_WORKSPACE_ID / POWERBI_REPORT_ID env vars.");
  }
  const res = await fetch(`${POWERBI_API_BASE}/groups/${workspaceId}/reports/${reportId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to fetch report metadata (${res.status}): ${detail}`);
  }
  const report = (await res.json()) as { datasetId?: string };
  if (!report.datasetId) throw new Error("Report metadata contained no datasetId.");
  reportMetaCache = { datasetId: report.datasetId, fetchedAt: Date.now() };
  return report.datasetId;
}

/**
 * Runs one DAX query using the service principal with the user's RLS identity.
 */
export async function executeDaxQuery(jwt: JWT, dax: string): Promise<unknown> {
  const token = await getServicePrincipalToken();
  const workspaceId = process.env.POWERBI_WORKSPACE_ID;
  if (!workspaceId) throw new Error("Missing POWERBI_WORKSPACE_ID env var.");
  const datasetId = await getDatasetId(token);

  const res = await fetch(
    `${POWERBI_API_BASE}/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ queries: [{ query: dax }] }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`executeQueries failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/** Extracts the first scalar value from an executeQueries response. */
export function firstScalar(response: unknown): number | null {
  const row = (response as { results?: { tables?: { rows?: Record<string, unknown>[] }[] }[] })
    ?.results?.[0]?.tables?.[0]?.rows?.[0];
  if (!row) return null;
  const first = Object.values(row)[0];
  return typeof first === "number" ? first : typeof first === "string" ? Number(first) || null : null;
}

/**
 * KPI → DAX mapping. v1 uses real row counts per model table — these are NOT
 * the report's measures (e.g. Delivery Hours is not the row count of
 * OrgHierarchy), so they must NOT override the dashboard until verified.
 *
 * The dashboard currently shows the report's real numbers from the
 * "Microsoft-GSI Delivery Dashboard" page (MSProgram=GSI): 42 / 38 / 510 /
 * 2,153 / 71 / 4.65 / 0, plus On-going 1 / Postponed 3. Once a session can
 * query the model (?schema=1), each `dax` below gets refined to the report's
 * actual measure (match `measureCandidates` against the INFO.MEASURES()
 * output) and its key added to VERIFIED_KPI_KEYS.
 */
export interface KpiQueryDef {
  label: string;
  /** Interim DAX — replaced by the report's real measure once verified. */
  dax: string;
  /** Executive value this KPI must reproduce for the owner scope. */
  expected: number;
  /** Measure names to match against INFO.MEASURES() output from ?schema=1. */
  measureCandidates: string[];
}

/**
 * KPIs allowed to override the sample/report values with live query results.
 * EMPTY until each DAX query is verified to reproduce the report's exact
 * executive numbers. Flip a key in here (and refine its `dax` above) once
 * /api/report-data?schema=1 confirms the measure semantics.
 */
export const VERIFIED_KPI_KEYS: string[] = [];

export const KPI_QUERIES: Record<string, KpiQueryDef> = {
  enquiries: {
    label: "Total Enquiries",
    dax: `EVALUATE ROW("v", COUNTROWS('EnquiryBridge'))`,
    expected: 71,
    measureCandidates: ["Total Enquiry", "Total Enquiries", "Enquiry Count"],
  },
  sessions: {
    label: "Total Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('Delivery_track'))`,
    expected: 42,
    measureCandidates: ["Total Sessions", "Session Count"],
  },
  completed: {
    label: "Completed Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('Core Data'))`,
    expected: 38,
    measureCandidates: ["Completed Sessions", "Completed Count"],
  },
  ongoing: {
    label: "On-going Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('Core Data'))`,
    expected: 1,
    measureCandidates: ["On-going Sessions", "Ongoing Sessions"],
  },
  postponed: {
    label: "Postponed Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('Core Data'))`,
    expected: 3,
    measureCandidates: ["Postponed Sessions"],
  },
  cancelled: {
    label: "Cancelled Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('Core Data'))`,
    expected: 0,
    measureCandidates: ["Cancelled Sessions", "Canceled Sessions"],
  },
  upcoming: {
    label: "Upcoming Sessions",
    dax: `EVALUATE ROW("v", COUNTROWS('SalesPipe 2026'))`,
    expected: 0,
    measureCandidates: ["Upcoming Sessions"],
  },
  hours: {
    label: "Delivery Hours",
    dax: `EVALUATE ROW("v", COUNTROWS('OrgHierarchy'))`,
    expected: 510,
    measureCandidates: ["Delivery Hours", "Total Delivery Hours", "Training Hours"],
  },
  learners: {
    label: "Learners",
    dax: `EVALUATE ROW("v", COUNTROWS('PersonMetrics'))`,
    expected: 2153,
    measureCandidates: ["Learners", "Total Learners", "Learner Count"],
  },
  feedback: {
    label: "Feedback Score",
    dax: `EVALUATE ROW("v", CALCULATE([Feedback Score]))`,
    expected: 4.65,
    measureCandidates: ["Feedback Score", "Average Feedback"],
  },
};

/**
 * Model catalog queries — used to refine KPI semantics after consent.
 * `columns` lists every table/column; `measures` lists the report's actual
 * measure names + expressions (the exact figures behind the dashboard).
 */
export const SCHEMA_QUERIES: Record<"columns" | "measures", { label: string; dax: string }> = {
  columns: {
    label: "Model columns",
    dax: `EVALUATE VAR c = INFO.COLUMNS() RETURN TOPN(2000, c, c[Name])`,
  },
  measures: {
    label: "Model measures",
    dax: `EVALUATE INFO.MEASURES()`,
  },
};
