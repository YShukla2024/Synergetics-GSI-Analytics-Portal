import type { DefaultSession } from "next-auth";
import type { PortalRole } from "@/lib/authz";
import type { AccessLevel } from "@/lib/access";

/**
 * Type augmentation for Auth.js v5.
 * Makes the extra session fields we store (id, roles, preferredUsername)
 * strongly typed across the whole app.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** Azure AD object ID (the `sub`/`oid` claim). */
      id: string;
      /** RBAC roles resolved from Entra ID claims (see lib/authz.ts). */
      roles: PortalRole[];
      /** Azure AD `preferred_username` (e.g. aditya.verma@synergetics.co.in). */
      preferredUsername?: string | null;
      /** Azure AD tenant (directory) ID the user belongs to. */
      tenantId?: string | null;
      /**
       * Local portal accounts only (see local-users.json). Undefined for
       * Microsoft Entra sessions, which keep unrestricted access.
       */
      accessLevel?: AccessLevel | null;
    } & DefaultSession["user"];
    /** Deliberately NO refreshToken here — Session is exposed to the browser. */
  }

  interface User {
    id: string;
    roles?: PortalRole[];
    /** Entra preferred_username (e.g. aditya.verma@synergetics.co.in). */
    preferredUsername?: string | null;
    /** Azure AD tenant (directory) ID the user belongs to. */
    tenantId?: string | null;
    /** OAuth refresh token captured at sign-in — server-only, used in jwt callback. */
    refreshToken?: string;
    /** Local portal accounts only (viewer / analyst / admin). */
    accessLevel?: AccessLevel;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: PortalRole[];
    preferredUsername?: string | null;
    tenantId?: string | null;
    /** OAuth refresh token (server-only) — redeemed for a Power BI token. */
    refreshToken?: string;
    /** Local portal accounts only (viewer / analyst / admin). */
    accessLevel?: AccessLevel;
  }
}
