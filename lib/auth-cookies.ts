/**
 * Reads the Auth.js session JWT directly from the request cookies.
 *
 * Behind iisnode on Windows Azure, `getToken()` from next-auth/jwt doesn't
 * work in App Router route handlers because it expects Node's IncomingMessage,
 * not a web Request. This utility reads cookies both from the raw request
 * headers AND from Next.js's cookies() API (which reads from the server context).
 */

const COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

/** Decode a JWT payload without verifying the signature (server-only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

/** Extract a cookie value from a raw Cookie header string. */
function getCookieValue(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\]/g, "\$&");
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\s*)${escapedName}=([^;]+)`)
  );
  return match?.[1] ?? null;
}

export interface SessionJwt {
  refreshToken?: string;
  email?: string;
  name?: string;
  accessLevel?: string;
}

function decodeToken(token: string): SessionJwt | null {
  const decoded = decodeJwt(token);
  if (!decoded) return null;
  return {
    refreshToken: decoded.refreshToken as string | undefined,
    email: (decoded.email as string) || (decoded.preferred_username as string),
    name: decoded.name as string | undefined,
    accessLevel: decoded.accessLevel as string | undefined,
  };
}

/**
 * Read the Auth.js session JWT from request cookies and decode it.
 * Returns null if no valid session is found.
 *
 * Tries three methods:
 * 1. Raw Cookie header from the request
 * 2. Next.js cookies() API (reads from server context)
 * 3. Falls back gracefully
 */
export async function getSessionFromRequest(
  request: { headers: { get(name: string): string | null } }
): Promise<SessionJwt | null> {
  console.log("[auth-cookies] getSessionFromRequest called");

  // Method 1: Read from raw Cookie header
  const cookieHeader = request.headers.get("cookie");
  console.log("[auth-cookies] Cookie header length:", cookieHeader?.length ?? 0);

  if (cookieHeader && cookieHeader.length > 10) {
    // Log first 100 chars for debugging
    console.log("[auth-cookies] Cookie preview:", cookieHeader.substring(0, 100));

    for (const name of COOKIE_NAMES) {
      const token = getCookieValue(cookieHeader, name);
      if (token) {
        console.log(`[auth-cookies] Found via header: ${name}`);
        return decodeToken(token);
      }
    }

    // Log available cookie names for debugging
    const names = cookieHeader.split(";").map(c => c.trim().split("=")[0]).filter(Boolean);
    console.log("[auth-cookies] Available cookie names:", names.join(", "));
  }

  // Method 2: Try Next.js cookies() API
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    for (const name of COOKIE_NAMES) {
      const value = cookieStore.get(name)?.value;
      if (value) {
        console.log(`[auth-cookies] Found via cookies(): ${name}`);
        return decodeToken(value);
      }
    }
    // Log all cookies from the store
    const allCookies = cookieStore.getAll().map(c => c.name);
    console.log("[auth-cookies] cookies() store names:", allCookies.join(", "));
  } catch (err) {
    console.log("[auth-cookies] cookies() API error:", err instanceof Error ? err.message : String(err));
  }

  console.log("[auth-cookies] No session found by any method");
  return null;
}
