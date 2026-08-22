/**
 * Auth.js (NextAuth v5) configuration — Microsoft Entra ID (Azure AD).
 * ---------------------------------------------------------------------------
 * This module is intentionally Edge-safe (no Node-only APIs) so the exact
 * same configuration can be used by the middleware (Edge runtime), the
 * API route handlers, and server components.
 *
 * Auth flows:
 *
 *   1. Email + password form  →  Credentials provider → Entra ROPC token
 *      exchange (login.microsoftonline.com) → secure JWT session.
 *      Works for accounts that do NOT require MFA / conditional access.
 *
 *   2. "Continue with Microsoft SSO"  →  OAuth redirect to Entra (needed for
 *      MFA / conditional-access accounts, which ROPC cannot satisfy).
 *
 * Both flows end with the same JWT shape: the user's id, roles, and — most
 * importantly — an Entra refresh token stored server-side. That token is
 * redeemed for a Power BI-scoped token (Dataset.Read.All) to query live
 * report data as the signed-in user (see lib/powerbi-user.ts), which is what
 * makes row-level security work per user.
 *
 * The backend that talks to the Power BI REST API for EMBED tokens stays
 * separate: it uses its own service principal (app/api/powerbi-embed-token/)
 * and is never mixed with the logged-in user's session.
 */

import type { NextAuthConfig } from "next-auth";
import { CredentialsSignin } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { resolveRoles, type PortalRole } from "@/lib/authz";
import { loadLocalUsers, verifyLocalPassword } from "@/lib/local-users";
import type { AccessLevel } from "@/lib/access";

/* ------------------------------------------------------------------------ *
 * Credentials (email + password) sign-in via the Entra ROPC grant.
 * ------------------------------------------------------------------------ */

/**
 * Error codes surfaced to the login page as ?code=<code> (and to the client
 * via `signIn(..., { redirect: false })` → `result.code`). Keep these generic
 * — never embed sensitive details in the code; the full Entra error is logged
 * server-side.
 */
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}
class MfaRequiredError extends CredentialsSignin {
  code = "mfa_required";
}
class AccountBlockedError extends CredentialsSignin {
  code = "account_blocked";
}
class PasswordExpiredError extends CredentialsSignin {
  code = "password_expired";
}
class ConsentRequiredError extends CredentialsSignin {
  code = "consent_required";
}
class ConfigError extends CredentialsSignin {
  code = "config_error";
}

/** Decodes a JWT payload (base64url) without Node-only APIs — Edge-safe. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const padded = payload
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(payload.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

/**
 * Exchanges a username/password for Entra tokens via the ROPC grant.
 * Returns the user identity + refresh token, or throws a CredentialsSignin
 * subclass with a client-safe code.
 */
async function ropcSignIn(username: string, password: string) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    console.error("[auth] AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET missing.");
    throw new ConfigError();
  }

  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        scope: "openid profile email offline_access",
      }),
    });
  } catch (err) {
    console.error("[auth] ROPC network error:", err);
    throw new ConfigError();
  }

  const data = (await res.json().catch(() => null)) as {
    id_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!res.ok || !data) {
    const code = data?.error ?? `http_${res.status}`;
    const description = data?.error_description ?? "";
    console.error(`[auth] ROPC sign-in failed (${res.status}): ${code} — ${description}`);

    // Wrong password / unknown account.
    if (/50126|50034|50128|invalid_grant/i.test(`${code} ${description}`)) {
      throw new InvalidCredentialsError();
    }
    // MFA / conditional-access challenge — ROPC cannot satisfy these.
    if (/50076|50079|53000|53003|interaction_required/i.test(`${code} ${description}`)) {
      throw new MfaRequiredError();
    }
    // Locked / disabled account.
    if (/50053|50057|account.*(locked|disabled)|locked.*account/i.test(description)) {
      throw new AccountBlockedError();
    }
    // Expired password.
    if (/50055|password.*expired/i.test(description)) {
      throw new PasswordExpiredError();
    }
    // Missing/ungranted API permission (e.g. Power BI Dataset.Read.All).
    if (/65001|consent/i.test(`${code} ${description}`)) {
      throw new ConsentRequiredError();
    }

    throw new ConfigError();
  }

  if (!data.id_token || !data.refresh_token) {
    console.error("[auth] ROPC response missing id_token/refresh_token.");
    throw new ConfigError();
  }

  const claims = decodeJwtPayload(data.id_token);
  const preferredUsername = String(claims.preferred_username ?? claims.email ?? username);
  return {
    id: String(claims.sub ?? claims.oid ?? ""),
    email: String(claims.email ?? preferredUsername),
    name: String(claims.name ?? preferredUsername.split("@")[0] ?? ""),
    preferredUsername,
    tenantId: String(claims.tid ?? ""),
    refreshToken: data.refresh_token,
    claims,
  };
}

const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const tenantId = process.env.AZURE_TENANT_ID;

if (!clientId || !clientSecret) {
  // Not fatal at build time — sign-in simply fails until .env.local is filled in.
  console.warn(
    "[auth] AZURE_CLIENT_ID / AZURE_CLIENT_SECRET are not configured — Entra ID sign-in is disabled."
  );
}

export const authConfig = {
  // Trust the host header so AUTH_URL / NEXTAUTH_URL is not required on
  // localhost or behind a proxy. NEXTAUTH_URL is still respected when set.
  trustHost: true,

  // v5 reads AUTH_SECRET by default; keep the requested NEXTAUTH_SECRET name
  // working too by passing it explicitly (empty strings are treated as unset).
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || undefined,

  session: { strategy: "jwt" },

  // Custom pages — Auth.js redirects here for sign-in and for errors (so
  // auth failures land on our styled login page with a readable message
  // instead of the default Auth.js error page).
  pages: { signIn: "/login", error: "/login" },

  providers: [
    // Email + password form, validated against Entra via the ROPC grant.
    // Returns the same JWT shape as the OAuth flow (id, roles, refresh
    // token), so the rest of the portal — including per-user Power BI / RLS
    // data access — works identically for both sign-in methods.
    Credentials({
      name: "Work email & password",
      credentials: {
        email: { label: "Work email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) throw new InvalidCredentialsError();
        const user = await ropcSignIn(email, password);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          preferredUsername: user.preferredUsername,
          tenantId: user.tenantId || undefined,
          roles: resolveRoles(user.claims),
          refreshToken: user.refreshToken,
        };
      },
    }),
    // Local portal accounts — username + password validated against the
    // gitignored local-users.json (see lib/local-users.ts). These sessions
    // carry an `accessLevel` (viewer / analyst / admin) that gates pages and
    // APIs; Microsoft Entra sessions have no access level and are never
    // restricted. This provider does not touch Power BI identity — local
    // users see the dashboard with its sample/fallback figures.
    Credentials({
      id: "local-credentials",
      name: "Portal username & password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!username || !password) throw new InvalidCredentialsError();
        const users = await loadLocalUsers();
        if (users.length === 0) throw new ConfigError();
        const record = users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase()
        );
        if (!record) throw new InvalidCredentialsError();
        const valid = await verifyLocalPassword(password, record.passwordHash);
        if (!valid) throw new InvalidCredentialsError();
        return {
          id: `local-${record.username.toLowerCase()}`,
          name: record.name || record.username,
          email: `${record.username.toLowerCase()}@portal.local`,
          preferredUsername: record.username,
          accessLevel: record.accessLevel,
        };
      },
    }),
    MicrosoftEntraID({
      clientId,
      clientSecret,
      // Restrict sign-in to this directory instead of the "common" endpoint.
      issuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : undefined,
      // User.Read lets the provider fetch the profile photo (48x48 base64)
      // from Microsoft Graph during the login callback. offline_access gives
      // us a refresh token, which the /api/report-data route redeems for a
      // Power BI-scoped token (Dataset.Read.All) to query live report data
      // as the signed-in user (see lib/powerbi-user.ts).
      authorization: {
        params: { scope: "openid profile email User.Read offline_access https://analysis.windows.net/powerbi/api/Dataset.Read.All", prompt: "select_account" },
      },
      // Use state-only check to avoid pkceCodeVerifier cookie corruption
      // across server restarts (fixes InvalidCheck: pkceCodeVerifier error).
      checks: ["state"],
    }),
  ],

  callbacks: {
    /**
     * Runs on every JWT request; `account`/`profile` are only present on the
     * initial sign-in. We persist a minimal, stable identity — the photo is
     * already captured into `session.user.image` by the provider at sign-in.
     */
    async jwt({ token, account, profile, user }) {
      if (account && profile) {
        // OAuth (Microsoft SSO) path.
        const p = profile as { sub?: string; preferred_username?: string; tid?: string };
        token.id = p.sub ?? token.sub;
        token.preferredUsername = p.preferred_username ?? token.email;
        token.tenantId = p.tid;
        // Resolve RBAC roles from Entra app-roles / security-group claims.
        token.roles = resolveRoles(profile);
        // Persist the OAuth refresh token server-side (never exposed to the
        // client). It is redeemed for a Power BI-scoped token when the
        // dashboard asks for live report data. The access token itself is NOT
        // stored — it targets Microsoft Graph (photo fetch) and is useless to
        // us, so keeping it out of the JWT avoids bloating the session cookie.
        token.refreshToken = account.refresh_token;
      } else if (user) {
        // Credentials path — ROPC (email + password) and local portal
        // accounts both arrive here with everything we need.
        token.id = user.id || token.sub || "";
        token.preferredUsername = user.preferredUsername ?? user.email;
        token.tenantId = user.tenantId;
        token.roles = user.roles ?? [];
        token.refreshToken = user.refreshToken;
        // Local accounts carry an access level; Entra accounts stay undefined
        // (→ unrestricted, unchanged behavior).
        token.accessLevel = (user.accessLevel as AccessLevel | undefined) ?? undefined;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
        session.user.preferredUsername =
          (token.preferredUsername as string | undefined) ?? session.user.email;
        session.user.tenantId = token.tenantId as string | undefined;
        session.user.roles = (token.roles as PortalRole[] | undefined) ?? [];
        session.user.accessLevel = token.accessLevel as AccessLevel | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
