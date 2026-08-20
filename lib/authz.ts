/**
 * Role-based access control (RBAC) helpers.
 * ---------------------------------------------------------------------------
 * The portal is prepared for RBAC now and wired to real claims later.
 *
 * Roles can arrive from Microsoft Entra ID in two ways:
 *
 *   1. App roles     -> the `roles` claim in the ID token (array of strings).
 *                       Configure these in Azure Portal under
 *                       "App registrations → <app> → App roles" and assign
 *                       them to users/groups.
 *
 *   2. Security      -> the `groups` claim (array of object IDs). By default
 *       groups          Entra ID does NOT emit groups unless you configure
 *                       them (app manifest -> groupMembershipClaims:
 *                       "SecurityGroup", or an optional claim). Object IDs
 *                       are opaque, so map them to portal roles with the
 *                       AZURE_GROUP_ROLE_MAP env var, e.g.:
 *
 *                       AZURE_GROUP_ROLE_MAP="<groupId>:Admin,<groupId>:Manager"
 *
 * If no claim-based roles can be resolved, the user falls back to "Viewer"
 * (least privilege).
 */

export const ROLES = ["Admin", "Manager", "Trainer", "Sales", "Viewer"] as const;

export type PortalRole = (typeof ROLES)[number];

const ROLE_NAMES: readonly string[] = ROLES;

/** Parses AZURE_GROUP_ROLE_MAP once at startup. */
function parseGroupRoleMap(): Record<string, PortalRole> {
  const map: Record<string, PortalRole> = {};
  const raw = process.env.AZURE_GROUP_ROLE_MAP;
  if (!raw) return map;
  for (const entry of raw.split(",")) {
    const [groupId, role] = entry.split(":").map((s) => s?.trim());
    if (groupId && role && ROLE_NAMES.includes(role)) {
      map[groupId] = role as PortalRole;
    }
  }
  return map;
}

const GROUP_ROLE_MAP = parseGroupRoleMap();

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Resolves the portal roles for a user from the raw Entra ID ID-token profile.
 * Accepts `unknown` so it can be called from any callback without casts.
 */
export function resolveRoles(profile: unknown): PortalRole[] {
  const p = (profile ?? {}) as { roles?: unknown; groups?: unknown };
  const roles = new Set<PortalRole>();

  // 1. App roles claim (already human-readable role names).
  for (const role of asStringArray(p.roles)) {
    if (ROLE_NAMES.includes(role)) roles.add(role as PortalRole);
  }

  // 2. Security-group object IDs mapped through AZURE_GROUP_ROLE_MAP.
  for (const groupId of asStringArray(p.groups)) {
    const role = GROUP_ROLE_MAP[groupId];
    if (role) roles.add(role);
  }

  // 3. Least-privilege default: everyone is a Viewer until roles are assigned.
  if (roles.size === 0) roles.add("Viewer");

  return [...roles];
}

/** True if the user holds at least one of the given roles. */
export function hasRole(
  roles: readonly PortalRole[] | undefined,
  ...required: PortalRole[]
): boolean {
  if (!roles || roles.length === 0) return false;
  return required.some((role) => roles.includes(role));
}

/**
 * Guard for route handlers / server components, e.g.:
 *   const role = requireRole(session, "Admin", "Manager");
 *   if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 * Returns the first matching role, or null.
 */
export function requireRole(
  roles: readonly PortalRole[] | undefined,
  ...required: PortalRole[]
): PortalRole | null {
  return required.find((role) => roles?.includes(role)) ?? null;
}
