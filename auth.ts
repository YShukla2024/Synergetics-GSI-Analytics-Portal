/**
 * Auth.js (NextAuth v5) instance for the GSI Analytics Portal.
 * Re-exported `auth` can be used in server components, route handlers and
 * middleware; `signIn`/`signOut` are the server-side actions.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
