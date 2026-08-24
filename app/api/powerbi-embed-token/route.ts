import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServicePrincipalToken } from "@/lib/powerbi-user";

/**
 * POST /api/powerbi-embed-token
 * Uses the service principal (client_credentials) + user's name as
 * effectiveIdentity for RLS. Matches the logged-in user's name to their
 * single RLS role (e.g. "Harish Suhanda" → role "Haris").
 */

const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

/**
 * Known RLS role names defined in Power BI Desktop.
 * Each role filters data for one person.
 * Matched by comparing the user's display name or email prefix against
 * these role names (case-insensitive prefix/substring match).
 */
const KNOWN_ROLES = ["Haris", "Liz", "Madhu", "Ram", "Saurabh", "Sricharan", "Srikant"];

/**
 * Match the logged-in user to their single RLS role.
 * Tries: exact match → prefix match → substring match.
 */
function matchRole(userEmail: string, jwtName?: string | null): string | null {
  const emailPrefix = userEmail.split("@")[0]?.toLowerCase() ?? "";
  const nameFirst = jwtName?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

  // Exact match: "ram" == "ram"
  for (const role of KNOWN_ROLES) {
    const r = role.toLowerCase();
    if (r === emailPrefix || r === nameFirst) return role;
  }

  // Prefix match: "rama" starts with "ram", "harishs" starts with "haris"
  for (const role of KNOWN_ROLES) {
    const r = role.toLowerCase();
    if (emailPrefix.startsWith(r) || nameFirst.startsWith(r)) return role;
  }

  // Substring fallback: "sricharanp" includes "sricharan"
  for (const role of KNOWN_ROLES) {
    const r = role.toLowerCase();
    if (emailPrefix.includes(r) || nameFirst.includes(r)) return role;
  }

  return null;
}

export async function POST(request: Request) {
  console.log("[embed-token] Request received");

  try {
    const jwt = await getToken({
      req: request as any,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      secureCookie: true,
    });

    if (!jwt) {
      console.log("[embed-token] No session found via getToken()");
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const userEmail =
      (jwt.email as string) ||
      (jwt.preferredUsername as string) ||
      (jwt.name as string) ||
      "";
    const jwtName = jwt.name as string | null | undefined;
    console.log(
      "[embed-token] User:", userEmail,
      "| name:", jwtName,
      "| email:", jwt.email,
      "| preferred:", jwt.preferredUsername,
    );

    const { workspaceId, reportId } = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      reportId?: string;
    };

    const groupId = workspaceId || process.env.POWERBI_WORKSPACE_ID;
    const targetReportId = reportId || process.env.POWERBI_REPORT_ID;

    if (!groupId || !targetReportId) {
      return NextResponse.json(
        { error: "workspaceId and reportId are required." },
        { status: 400 },
      );
    }

    console.log("[embed-token] Getting service principal token...");
    const spToken = await getServicePrincipalToken();

    console.log("[embed-token] Fetching report metadata...");
    const reportRes = await fetch(
      `${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}`,
      { headers: { Authorization: `Bearer ${spToken}` } },
    );

    if (!reportRes.ok) {
      const detail = await reportRes.text();
      console.error("[embed-token] Report metadata failed:", reportRes.status, detail);
      return NextResponse.json(
        { error: `Report metadata failed (${reportRes.status}): ${detail}` },
        { status: 502 },
      );
    }
    const report = (await reportRes.json()) as {
      embedUrl: string;
      datasetId: string;
      id: string;
    };

    // Match user to their single RLS role (not ALL roles!)
    const matchedRole = matchRole(userEmail, jwtName);
    console.log("[embed-token] Matched RLS role:", matchedRole ?? "(none)");

    // Build effective identity — ONE role per user, never all roles
    const identity: {
      username: string;
      datasets: string[];
      roles?: string[];
    } = {
      username: userEmail,
      datasets: [report.datasetId],
    };

    if (matchedRole) {
      identity.roles = [matchedRole];
    }

    console.log("[embed-token] Generating embed token with identity:", JSON.stringify(identity));
    const tokenRes = await fetch(
      `${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}/GenerateToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${spToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessLevel: "View",
          datasets: [{ id: report.datasetId }],
          reports: [{ allowEdit: false, id: report.id }],
          identities: [identity],
        }),
      },
    );
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      console.error("[embed-token] GenerateToken failed:", tokenRes.status, detail);
      return NextResponse.json(
        { error: `GenerateToken failed (${tokenRes.status}): ${detail}` },
        { status: 502 },
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
