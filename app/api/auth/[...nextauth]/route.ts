import { handlers } from "@/auth";

/**
 * Auth.js v5 catch-all route handler.
 * Pipe prefix fix is handled by AUTH_URL env var + trustHost: true
 * in auth.config.ts. No URL manipulation needed here.
 */
export const { GET, POST } = handlers;
