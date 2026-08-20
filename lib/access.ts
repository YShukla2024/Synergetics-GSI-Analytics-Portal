/**
 * Access levels for local portal accounts (see local-users.json).
 * ---------------------------------------------------------------------------
 * Microsoft Entra ID sessions carry NO access level — those users keep their
 * current unrestricted access (this must never change). Local accounts always
 * have one of the levels below, which gate pages and APIs:
 *
 *   viewer  → Dashboard only
 *   analyst → Dashboard + Analytics (+ schema / embed APIs)
 *   admin   → everything, including Settings
 */

export const ACCESS_LEVELS = ["viewer", "analyst", "admin"] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  viewer: "Viewer",
  analyst: "Analyst",
  admin: "Administrator",
};

/** Higher = more access. */
const RANK: Record<AccessLevel, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
};

/**
 * True if `level` is at least one of the required levels.
 *
 * IMPORTANT: `undefined`/`null` (a Microsoft Entra session, or a local session
 * created before levels existed) is treated as FULL access so the existing
 * Microsoft sign-in behavior is never restricted.
 */
export function canAccess(
  level: AccessLevel | undefined | null,
  ...required: AccessLevel[]
): boolean {
  if (!level) return true;
  const rank = RANK[level] ?? -1;
  return required.some((r) => rank >= RANK[r]);
}

/** Human-readable label, falling back to "Portal user". */
export function accessLabel(level: AccessLevel | undefined | null): string {
  return level ? ACCESS_LEVEL_LABEL[level] : "Portal user";
}
