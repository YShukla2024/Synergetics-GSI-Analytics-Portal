/**
 * Local portal accounts — the users/passwords defined in the gitignored
 * `local-users.json` (project root) for viewing the GSI dashboard without
 * Microsoft Entra ID.
 * ---------------------------------------------------------------------------
 * Passwords are PBKDF2-SHA256 hashes (`pbkdf2$<iterations>$<saltHex>$<hashHex>`),
 * generated with `scripts/hash-local-password.mjs`. Verification uses the Web
 * Crypto API (works in both the Node and Edge runtimes), so this module can be
 * imported from the shared auth config.
 */

import type { AccessLevel } from "@/lib/access";

export interface LocalUserRecord {
  username: string;
  name?: string;
  accessLevel: AccessLevel;
  passwordHash: string;
}

const VALID_LEVELS: readonly string[] = ["viewer", "analyst", "admin"];

const textEncoder = new TextEncoder();

function parseUsers(raw: string): LocalUserRecord[] {
  const parsed = JSON.parse(raw) as { users?: unknown };
  if (!Array.isArray(parsed.users)) return [];
  return parsed.users.filter(
    (u): u is LocalUserRecord =>
      Boolean(u) &&
      typeof (u as LocalUserRecord).username === "string" &&
      typeof (u as LocalUserRecord).passwordHash === "string" &&
      VALID_LEVELS.includes((u as LocalUserRecord).accessLevel)
  );
}

/**
 * Loads the local account list.
 *   1. `LOCAL_USERS` env var (JSON in the same shape as the file) wins when set.
 *   2. Otherwise reads local-users.json from the project root (Node runtime).
 * Returns [] if neither is available — sign-in then fails with a clear error.
 */
export async function loadLocalUsers(): Promise<LocalUserRecord[]> {
  const fromEnv = process.env.LOCAL_USERS;
  if (fromEnv) {
    try {
      return parseUsers(fromEnv);
    } catch {
      // Fall through to the file.
    }
  }
  try {
    // webpackIgnore keeps these runtime requires — the module is only ever
    // imported inside authorize() (Node runtime), never in the middleware
    // Edge bundle, so webpack must not try to bundle/resolve node:fs/path.
    // process.cwd() is used (not import.meta.url) because in the compiled
    // server bundle import.meta.url points into .next/, not the project root.
    const { readFile } = await import(/* webpackIgnore: true */ "node:fs/promises");
    const { join } = await import(/* webpackIgnore: true */ "node:path");
    const raw = await readFile(join(process.cwd(), "local-users.json"), "utf8");
    return parseUsers(raw);
  } catch (err) {
    console.error(
      "[local-auth] Could not read local-users.json — local portal sign-in disabled.",
      err
    );
    return [];
  }
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Verifies a plaintext password against a stored `pbkdf2$…` hash using the
 * Web Crypto API. Constant-time comparison; never throws for bad input.
 */
export async function verifyLocalPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const saltHex = parts[2] ?? "";
  const expectedHex = parts[3] ?? "";
  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(expectedHex);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 10_000_000) return false;
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      keyMaterial,
      expected.length * 8
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
    return diff === 0;
  } catch {
    return false;
  }
}
