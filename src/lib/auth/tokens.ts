import { createHash, randomBytes } from "node:crypto";

/** URL-safe random token (256 bits). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed so a database leak does not leak live sessions or reset links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
