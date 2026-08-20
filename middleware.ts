/**
 * Middleware — route protection + access-level gating.
 * ---------------------------------------------------------------------------
 * - Pages other than /login and /local-login require a valid session
 *   → redirect to the sign-in page (remembering where they came from).
 * - /api/* (except /api/auth) require a session → HTTP 401 JSON.
 * - Local portal accounts are gated by their access level:
 *     /analytics + embed-token APIs → analyst or higher
 *     /settings                    → admin
 *   Microsoft Entra sessions have no access level and are never restricted
 *   (unchanged behavior).
 *
 * Stays on the default Edge runtime: lib/local-users.ts reads local-users.json
 * with a webpackIgnore'd dynamic import that only ever runs inside the
 * authorize() callback (Node runtime), never in this middleware.
 */
import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { canAccess } from "@/lib/access";

export default auth(async (req) => {
  const { nextUrl } = req;

  // Read the JWT directly so the access level (set at sign-in) is available
  // here without depending on session-callback mapping.
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // API routes: respond with 401 JSON instead of a redirect.
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized — sign in to continue." }, { status: 401 });
    }

    // Pages: bounce to the sign-in page, remembering where they came from.
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const level = token.accessLevel;
  const path = nextUrl.pathname;

  // Page gating for local portal accounts (Entra users → level undefined →
  // canAccess returns true, so nothing changes for them).
  if (path.startsWith("/analytics") && !canAccess(level, "analyst")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
  if (path.startsWith("/settings") && !canAccess(level, "admin")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Analytics backing APIs: embed tokens require analyst+ (the dashboard's
  // /api/report-data stays open to all authenticated users).
  if (path.startsWith("/api/powerbi-embed-token") && !canAccess(level, "analyst")) {
    return NextResponse.json(
      { error: "Forbidden — your access level cannot view analytics." },
      { status: 403 }
    );
  }

  return NextResponse.next();
});

export const config = {
  // Everything except Next.js internals, static images/favicon, the sign-in
  // pages, and the Auth.js API. (public/ assets like the Synergetics logo must
  // stay reachable before sign-in, e.g. on the login page.)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|local-login|api/auth|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
