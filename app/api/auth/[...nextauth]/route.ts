import { handlers } from "@/auth";
import { NextRequest } from "next/server";

async function stripPipePrefix(req: NextRequest): Promise<NextRequest> {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/pipe/")) {
    const slashIdx = pathname.indexOf("/", 7);
    if (slashIdx !== -1) {
      const newUrl = new URL(req.url);
      newUrl.pathname = pathname.substring(slashIdx);
      // Reconstructing NextRequest from another Request doesn't reliably
      // forward the body (needed for POST /api/auth/signin's CSRF token) —
      // read it explicitly instead.
      const init: RequestInit = { method: req.method, headers: req.headers };
      if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = await req.arrayBuffer();
      }
      return new NextRequest(newUrl, init);
    }
  }
  return req;
}

export async function GET(req: NextRequest) {
  return handlers.GET(await stripPipePrefix(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(await stripPipePrefix(req));
}
