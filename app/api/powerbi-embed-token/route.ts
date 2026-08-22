import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * POST /api/powerbi-embed-token
 * Uses getToken() — the same proven approach as middleware — to read the
 * session. The encrypted JWT is decrypted by next-auth using AUTH_SECRET,
 * and the refresh token inside is exchanged for a Power BI scoped token.
 */

const POWERBI_SCOPE = "https://analysis.windows.net/powerbi/api/Dataset.Read.All";
const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

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
  console.log("[embed-token] Request received");

  try {
    // Use the same getToken() that middleware uses — it decrypts the
    // encrypted session cookie correctly.
    const jwt = await getToken({
      req: request as any,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      secureCookie: true,
    });

    if (!jwt) {
      console.log("[embed-token] No session found via getToken()");
      return NextResponse.json(
        { error: "No refresh token available. Please sign in again." },
        { status: 401 }
      );
    }

    const refreshToken = jwt.refreshToken as string | undefined;
    if (!refreshToken) {
      console.log("[embed-token] Session found but no refreshToken. Email:", jwt.email);
      return NextResponse.json(
        { error: "No refresh token available. Please sign in again." },
        { status: 401 }
      );
    }

    console.log("[embed-token] User:", jwt.email);

    const { workspaceId, reportId } = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      reportId?: string;
    };

    const groupId = workspaceId || process.env.POWERBI_WORKSPACE_ID;
    const targetReportId = reportId || process.env.POWERBI_REPORT_ID;

    if (!groupId || !targetReportId) {
      return NextResponse.json({ error: "workspaceId and reportId are required." }, { status: 400 });
    }

    console.log("[embed-token] Exchanging refresh token for Power BI token...");
    const aadToken = await getUserPowerBIToken(refreshToken);

    console.log("[embed-token] Fetching report metadata...");
    const reportRes = await fetch(`${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}`, {
      headers: { Authorization: `Bearer ${aadToken}` },
    });
    if (!reportRes.ok) {
      const detail = await reportRes.text();
      console.error("[embed-token] Report metadata failed:", reportRes.status, detail);
      return NextResponse.json({ error: `Failed to fetch report metadata (${reportRes.status}): ${detail}` }, { status: 502 });
    }
    const report = (await reportRes.json()) as { embedUrl: string; datasetId: string; id: string };

    const rlsRoles = (process.env.POWERBI_RLS_ROLES ?? "").split(",").map((r) => r.trim()).filter(Boolean);
    const userIdentity = rlsRoles.length > 0
      ? { username: jwt.email ?? jwt.name ?? "", datasets: [report.datasetId], roles: rlsRoles }
      : undefined;

    console.log("[embed-token] Generating embed token...");
    const tokenRes = await fetch(`${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}/GenerateToken`, {
      method: "POST",
      headers: { Authorization: `Bearer ${aadToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        accessLevel: "View",
        datasets: [{ id: report.datasetId }],
        reports: [{ allowEdit: false, id: report.id }],
        ...(userIdentity ? { identities: [userIdentity] } : {}),
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      console.error("[embed-token] GenerateToken failed:", tokenRes.status, detail);
      return NextResponse.json({ error: `Failed to generate embed token (${tokenRes.status}): ${detail}` }, { status: 502 });
    }
    const tokenJson = (await tokenRes.json()) as { token: string; expiration: string };

    console.log("[embed-token] Success! Token expires:", tokenJson.expiration);
    return NextResponse.json({
      embedUrl: report.embedUrl,
      reportId: report.id,
      embedToken: tokenJson.token,
      expiration: tokenJson.expiration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[embed-token] CRASH:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
