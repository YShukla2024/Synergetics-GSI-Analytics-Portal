import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServicePrincipalToken } from "@/lib/powerbi-user";

/**
 * POST /api/powerbi-embed-token
 * Uses the service principal (client_credentials) + user's name as
 * effectiveIdentity for RLS. Fetches available RLS roles from the Power BI
 * API and dynamically picks the role matching the logged-in user's first name.
 */

const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

/** Fetch all RLS roles defined on the report. */
async function getReportRoles(
  spToken: string,
  groupId: string,
  reportId: string,
): Promise<{ name: string; members: { emailAddress?: string }[] }[]> {
  const res = await fetch(
    `${POWERBI_API_BASE}/groups/${groupId}/reports/${reportId}/roles`,
    { headers: { Authorization: `Bearer ${spToken}` } },
  );
  if (!res.ok) {
    console.error("[embed-token] Failed to fetch RLS roles:", res.status);
    return [];
  }
  const data = (await res.json()) as {
    value: { name: string; members: { emailAddress?: string }[] }[];
  };
  return data.value ?? [];
}

/**
 * Match the logged-in user to their RLS role.
 * Extracts the first name from the email (e.g. "saurabh@..." → "Saurabh")
 * and compares case-insensitively against the role names.
 */
function matchRole(
  roles: { name: string }[],
  userEmail: string,
  jwtName?: string | null,
): string | null {
  // Try matching by email prefix (first name before @)
  const emailPrefix = userEmail.split("@")[0]?.toLowerCase() ?? "";
  // Try matching by JWT name first word
  const nameFirst = jwtName?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

  for (const role of roles) {
    const roleName = role.name.toLowerCase();
    if (roleName === emailPrefix || roleName === nameFirst) {
      return role.name; // Return exact casing from Power BI
    }
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
      "[embed-token] User:",
      userEmail,
      "| name:",
      jwtName,
      "| email:",
      jwt.email,
      "| preferred:",
      jwt.preferredUsername,
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

    // Fetch report metadata and RLS roles in parallel
    console.log("[embed-token] Fetching report metadata and RLS roles...");
    const [reportRes, roles] = await Promise.all([
      fetch(`${POWERBI_API_BASE}/groups/${groupId}/reports/${targetReportId}`, {
        headers: { Authorization: `Bearer ${spToken}` },
      }),
      getReportRoles(spToken, groupId, targetReportId),
    ]);

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

    console.log(
      "[embed-token] Available RLS roles:",
      roles.map((r) => r.name),
    );

    // Dynamically match the user to their RLS role
    const matchedRole = matchRole(roles, userEmail, jwtName);
    console.log("[embed-token] Matched RLS role:", matchedRole ?? "(none — no filtering)");

    // Build effective identity — always include username so Power BI can apply RLS
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
    } else {
      // Fallback: check env var if no dynamic match found
      const envRoles = (process.env.POWERBI_RLS_ROLES ?? "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (envRoles.length > 0) {
        identity.roles = envRoles;
      }
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
