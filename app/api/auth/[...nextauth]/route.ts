import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auth.js catch-all route handler.
 * Wraps the default handlers to strip iisnode named pipe prefix from URLs.
 * On Windows Azure App Service, iisnode passes URLs as /pipe/<uuid>/...
 * which breaks NextAuth's URL parsing. This wrapper fixes that.
 */
function stripPipePrefix(req: NextRequest): NextRequest {
  const url = req.nextUrl;
  const pathname = url.pathname;
  if (pathname.startsWith("/pipe/")) {
    const slashIdx = pathname.indexOf("/", 7);
    if (slashIdx !== -1) {
      url.pathname = pathname.substring(slashIdx);
      return new NextRequest(url, req);
    }
  }
  return req;
}

const originalGet = handlers.GET;
const originalPost = handlers.POST;

export async function GET(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return originalGet(stripPipePrefix(req), ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return originalPost(stripPipePrefix(req), ctx);
}
