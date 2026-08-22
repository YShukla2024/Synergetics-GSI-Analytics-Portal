import { handlers } from "@/auth";
import { NextRequest } from "next/server";

/**
 * Auth.js v5 catch-all route handler.
 * Wraps the default handlers to strip iisnode named pipe prefix from URLs.
 * On Windows Azure App Service, iisnode passes URLs as /pipe/<uuid>/...
 * which breaks NextAuth's URL parsing. This wrapper fixes that.
 */
function stripPipePrefix(req: NextRequest): NextRequest {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/pipe/")) {
    const slashIdx = pathname.indexOf("/", 7);
    if (slashIdx !== -1) {
      const newUrl = new URL(req.url);
      newUrl.pathname = pathname.substring(slashIdx);
      return new NextRequest(newUrl, req);
    }
  }
  return req;
}

const originalGet = handlers.GET;
const originalPost = handlers.POST;

export async function GET(req: NextRequest, _ctx: { params: Promise<{ nextauth: string[] }> }) {
  return originalGet(stripPipePrefix(req));
}

export async function POST(req: NextRequest, _ctx: { params: Promise<{ nextauth: string[] }> }) {
  return originalPost(stripPipePrefix(req));
}
