/**
 * Middleware — route protection + access-level gating.
 *
 * Strips the iisnode named-pipe prefix (/pipe/<uuid>) from URLs on Windows
 * Azure App Service so all downstream path checks and redirects use clean paths.
 *
 * Uses getToken() directly instead of the auth() wrapper to avoid the wrapper
 * processing the pipe-prefixed URL and generating broken redirect URLs.
 */
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

export default async function middleware(req: NextRequest) {
  const nextUrl = cleanPathname(req.nextUrl);

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  // API routes: 401 JSON if not authenticated.
  if (nextUrl.pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized — sign in to continue." }, { status: 401 });
    }

    // Analytics backing APIs: embed tokens require analyst+.
    if (nextUrl.pathname.startsWith("/api/powerbi-embed-token")) {
      const level = token.accessLevel;
      if (!canAccess(level, "analyst")) {
        return NextResponse.json(
          { error: "Forbidden — your access level cannot view analytics." },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  }

  // Page routes: redirect to login if no session.
  if (!token) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Page gating for local portal accounts (Entra users → level undefined → unrestricted).
  const level = token.accessLevel;
  const path = nextUrl.pathname;

  if (path.startsWith("/analytics") && !canAccess(level, "analyst")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }
  if (path.startsWith("/settings") && !canAccess(level, "admin")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|local-login|api/auth|.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
