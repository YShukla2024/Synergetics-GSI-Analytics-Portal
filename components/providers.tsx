"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * Client-side session context. `session` comes from the server (auth() in the
 * root layout) so there is no "flash" of logged-out UI; afterwards it is kept
 * in sync by Auth.js.
 */
export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
