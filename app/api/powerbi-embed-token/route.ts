import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess } from "@/lib/access";

/**
 * POST /api/powerbi-embed-token
 * ------------------------------------------------------------------
 * Generates a Power BI embed token using the signed-in user's own
 * OAuth refresh token (delegated access). This avoids needing
 * service-principal Application permissions, which Power BI doesn't
 * expose for Dataset.Read.All.
 * ------------------------------------------------------------------
 */

const POWERBI_SCOPE = "https://analysis.windows.net/powerbi/api/Dataset.Read.All";
const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

/** Exchange the user's refresh token for a Power BI scoped access token. */
async function getUserPowerBIToken(refreshToken: string): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET env vars.");
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      scope: POWERBI_SCOPE,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Power BI token refresh failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Access control: analytics embeds require at least analyst level.
    if (!canAccess(session.user.accessLevel, "analyst")) {
      return NextResponse.json(
        { error: "Forbidden — your access level cannot view analytics." },
        { status: 403 }
      );
    }

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

    const refreshToken = session.user.refreshToken;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "No refresh token available. Please sign in again." },
        { status: 401 }
      );
    }

    // Exchange refresh token for Power BI scoped access token.
    const aadToken = await getUserPowerBIToken(refreshToken);

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

    // Effective identity for RLS.
    const rlsRoles = (process.env.POWERBI_RLS_ROLES ?? "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    const userIdentity =
      rlsRoles.length > 0
        ? {
            username:
              session.user.email ?? session.user.preferredUsername ?? session.user.name ?? "",
            datasets: [report.datasetId],
            roles: (() => {
              const u = session.user;
              const emailLocal = u.email?.split("@")[0]?.toLowerCase();
              const givenName = u.name?.split(" ")[0]?.toLowerCase();
              const matched = rlsRoles.find((role) => {
                const r = role.toLowerCase();
                if (r === emailLocal || r === givenName) return true;
                if (givenName && (givenName.startsWith(r) || r.startsWith(givenName))) return true;
                if (emailLocal && (emailLocal.startsWith(r) || r.startsWith(emailLocal))) return true;
                return false;
              });
              return matched ? [matched] : rlsRoles;
            })(),
          }
        : undefined;

    // Generate the embed token using the user's own access token.
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
