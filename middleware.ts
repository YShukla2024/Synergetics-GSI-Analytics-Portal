/**
 * Middleware — route protection + access-level gating.
 *
 * Strips the iisnode named-pipe prefix (/pipe/<uuid>) from URLs on Windows
 * Azure App Service so all downstream path checks and redirects use clean paths.
 */
import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { canAccess } from "@/lib/access";

/**
 * On Windows Azure App Service, iisnode passes URLs like
 * /pipe/<uuid>/dashboard to Node.js. This strips the prefix so
 * pathname checks and redirects use the real path.
 */
function cleanPathname(nextUrl: URL): URL {
  const p = nextUrl.pathname;
  if (p.startsWith("/pipe/")) {
    const slashIdx = p.indexOf("/", 7);
    if (slashIdx !== -1) {
      const clean = new URL(nextUrl);
      clean.pathname = p.substring(slashIdx);
      return clean;
    }
  }
  return nextUrl;
}

export default auth(async (req) => {
  const nextUrl = cleanPathname(req.nextUrl);

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|local-login|api/auth|.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
