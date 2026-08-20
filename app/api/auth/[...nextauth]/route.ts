import { handlers } from "@/auth";

/**
 * Auth.js catch-all route handler.
 * Mounts GET (sign-in / callback / session) and POST (CSRF, credentials)
 * endpoints under /api/auth/*.
 */
export const { GET, POST } = handlers;
