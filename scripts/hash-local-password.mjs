/**
 * Generates a PBKDF2 password hash for local-users.json.
 *
 * Usage:
 *   node scripts/hash-local-password.mjs "<password>"
 *
 * Paste the printed hash into local-users.json under `passwordHash`.
 * The format matches what lib/local-users.ts verifies:
 *   pbkdf2$<iterations>$<saltHex>$<hashHex>
 */
import { randomBytes, pbkdf2Sync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-local-password.mjs "<password>"');
  process.exit(1);
}

const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");

console.log(
  `pbkdf2$${iterations}$${salt.toString("hex")}$${hash.toString("hex")}`
);
