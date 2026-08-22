import { handlers } from "@/auth";
import { NextRequest } from "next/server";

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

export async function GET(req: NextRequest) {
  return handlers.GET(stripPipePrefix(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(stripPipePrefix(req));
}
