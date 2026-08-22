import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServicePrincipalToken } from "@/lib/powerbi-user";

/**
 * POST /api/powerbi-embed-token
 *
 * Uses the SERVICE PRINCIPAL (client_credentials) to authenticate with
 * Power BI — the same token that lib/powerbi-user.ts uses for DAX queries.
 * The signed-in user's email is passed as effectiveIdentity for RLS.
 * This avoids requiring Power BI Pro licenses for individual users.
 */

const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

export async function POST(request: Request) {
  console.log("[embed-token] Request received");

  try {
    // Authenticate the user session
    const jwt = await getToken({
      req: request as any,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      secureCookie: true,
    });

    if (!jwt) {
      console.log("[embed-token] No session found via getToken()");
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const userEmail = (jwt.email as string) ?? "";
    console.log("[embed-token] User:", userEmail);

    const { workspaceId, reportId } = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      reportId?: string;
    };

    const groupId = workspaceId || process.env.POWERBI_WORKSPACE_ID;
    const targetReportId = reportId || process.env.POWERBI_REPORT_ID;

    if (!groupId || !targetReportId) {
      return NextResponse.json({ error: "workspaceId and reportId are required." }, { status: 400 });
    }

    // Use the service principal token (client_credentials) — same as DAX queries
    console.log("[embed-token] Getting service principal token...");
    const spToken = await getServicePrincipalToken();

    console.log("[embed-token] Fetching report metadata...");
    const reportRes = await fetch(`${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}`, {
      headers: { Authorization: `Bearer ${spToken}` },
    });
    if (!reportRes.ok) {
      const detail = await reportRes.text();
      console.error("[embed-token] Report metadata failed:", reportRes.status, detail);
      return NextResponse.json(
        { error: `Failed to fetch report metadata (${reportRes.status}): ${detail}` },
        { status: 502 }
      );
    }
    const report = (await reportRes.json()) as { embedUrl: string; datasetId: string; id: string };

    // RLS identity — the user's email tells Power BI which RLS role to apply
    const rlsRoles = (process.env.POWERBI_RLS_ROLES ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const userIdentity =
      rlsRoles.length > 0
        ? { username: userEmail, datasets: [report.datasetId], roles: rlsRoles }
        : undefined;

    console.log("[embed-token] Generating embed token...");
    const tokenRes = await fetch(
      `${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}/GenerateToken`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${spToken}`, "Content-Type": "application/json" },
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
      console.error("[embed-token] GenerateToken failed:", tokenRes.status, detail);
      return NextResponse.json(
        { error: `Failed to generate embed token (${tokenRes.status}): ${detail}` },
        { status: 502 }
      );
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
