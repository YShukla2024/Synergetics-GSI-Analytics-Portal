import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess } from "@/lib/access";

/**
 * POST /api/powerbi-embed-token
 * ------------------------------------------------------------------
 * Generates a short-lived Power BI "embed for your customers" token
 * (App Owns Data) using an Azure AD service principal. The frontend
 * never sees the service principal secret — only the resulting
 * embedUrl + embedToken, which expire after ~60 minutes.
 *
 * Two independent auth layers (never mixed):
 *   - The logged-in user (via the Auth.js session) is passed to Power BI
 *     as the embed token's *effective identity* when the dataset uses
 *     row-level security / an on-prem gateway (see POWERBI_RLS_ROLES).
 *   - The backend authenticates as the service principal for all Power BI
 *     REST API calls.
 *
 * One-time setup (do this in Azure / Power BI, not in code):
 *   1. Azure Portal → App registrations → New registration.
 *      Note the Application (client) ID and Directory (tenant) ID.
 *   2. Certificates & secrets → New client secret. Note the value —
 *      you only see it once.
 *   3. In the Power BI Admin Portal → Tenant settings → "Allow
 *      service principals to use Power BI APIs" → enable it for a
 *      security group that contains this app registration.
 *   4. In the Power BI workspace that holds the report → Access →
 *      add the app registration (service principal) as a Member
 *      or Admin.
 *   5. Set the environment variables below (e.g. in .env.local — see
 *      .env.example). Never commit real secrets.
 *
 * Required env vars:
 *   POWERBI_TENANT_ID
 *   POWERBI_CLIENT_ID
 *   POWERBI_CLIENT_SECRET
 *   POWERBI_WORKSPACE_ID   (the Fabric/Power BI workspace GUID)
 *   POWERBI_REPORT_ID      (the report GUID to embed)
 *
 * Optional env vars:
 *   POWERBI_RLS_ROLES      comma-separated RLS role names defined on the
 *                          dataset (e.g. "Manager,Sales"). Required when
 *                          the dataset demands an effective identity.
 * ------------------------------------------------------------------
 */

const AAD_TOKEN_SCOPE = "https://analysis.windows.net/powerbi/api/.default";
const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

async function getServicePrincipalAccessToken() {
  const tenantId = process.env.POWERBI_TENANT_ID;
  const clientId = process.env.POWERBI_CLIENT_ID;
  const clientSecret = process.env.POWERBI_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing POWERBI_TENANT_ID / POWERBI_CLIENT_ID / POWERBI_CLIENT_SECRET env vars."
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: AAD_TOKEN_SCOPE,
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AAD token request failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function POST(request: Request) {
  try {
    const { workspaceId, reportId } = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      reportId?: string;
    };

    const groupId = workspaceId || process.env.POWERBI_WORKSPACE_ID;
    const targetReportId = reportId || process.env.POWERBI_REPORT_ID;

    if (!groupId || !targetReportId) {
      return NextResponse.json(
        { error: "workspaceId and reportId are required (env defaults not configured)." },
        { status: 400 }
      );
    }

    const aadToken = await getServicePrincipalAccessToken();

    // Fetch report metadata (gives us the embedUrl + datasetId).
    const reportRes = await fetch(
      `${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}`,
      { headers: { Authorization: `Bearer ${aadToken}` } }
    );
    if (!reportRes.ok) {
      const detail = await reportRes.text();
      return NextResponse.json(
        { error: `Failed to fetch report metadata (${reportRes.status}): ${detail}` },
        { status: 502 }
      );
    }
    const report = (await reportRes.json()) as { embedUrl: string; datasetId: string; id: string };

    // Access control: analytics embeds require at least analyst level.
    // Microsoft Entra sessions (no access level) keep full access.
    const session = await auth();
    if (!canAccess(session?.user?.accessLevel, "analyst")) {
      return NextResponse.json(
        { error: "Forbidden — your access level cannot view analytics." },
        { status: 403 }
      );
    }

    // Effective identity: datasets that use row-level security (or an
    // on-prem gateway) require the token to impersonate a user with the
    // dataset's RLS roles. We use the signed-in portal user (their UPN)
    // so Power BI applies that user's own RLS filtering.
    const rlsRoles = (process.env.POWERBI_RLS_ROLES ?? "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    const userIdentity =
      rlsRoles.length > 0 && session?.user
        ? {
            username:
              session.user.email ?? session.user.preferredUsername ?? session.user.name ?? "",
            datasets: [report.datasetId],
            // Pick the role matching THIS user (email local-part or given
            // name, case-insensitive) so each person sees only their rows.
            // Fall back to ALL roles (full dataset) when no role matches,
            // e.g. admins/overview users not named in the RLS roles.
            roles: (() => {
              const u = session.user;
              const emailLocal = u.email?.split("@")[0]?.toLowerCase();
              const givenName = u.name?.split(" ")[0]?.toLowerCase();
              const matched = rlsRoles.find((role) => {
                const r = role.toLowerCase();
                // Exact match on email local-part or given name.
                if (r === emailLocal || r === givenName) return true;
                // Prefix match: "Haris" matches "Harish", "Saurabh" matches "SaurabhR", etc.
                if (givenName && (givenName.startsWith(r) || r.startsWith(givenName))) return true;
                if (emailLocal && (emailLocal.startsWith(r) || r.startsWith(emailLocal))) return true;
                return false;
              });
              return matched ? [matched] : rlsRoles;
            })(),
          }
        : undefined;

    // Request the embed token scoped to this specific report/dataset.
    const tokenRes = await fetch(
      `${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}/GenerateToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aadToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessLevel: "View",
          datasets: [{ id: report.datasetId }],
          reports: [{ allowEdit: false, id: report.id }],
          ...(userIdentity ? { identities: [userIdentity] } : {}),
        }),
      }
    );
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return NextResponse.json(
        { error: `Failed to generate embed token (${tokenRes.status}): ${detail}` },
        { status: 502 }
      );
    }
    const tokenJson = (await tokenRes.json()) as { token: string; expiration: string };

    return NextResponse.json({
      embedUrl: report.embedUrl,
      reportId: report.id,
      embedToken: tokenJson.token,
      expiration: tokenJson.expiration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating embed token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
