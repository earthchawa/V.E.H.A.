import { msg, type Msg } from "../i18n";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const BCRYPT_COST = 12;
export const PASSWORD_MIN = 8;
/** bcrypt only uses the first 72 bytes. */
export const PASSWORD_MAX = 72;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Returns an error message, or null when the password is acceptable. */
export function checkPasswordPolicy(password: string, username: string): Msg | null {
  if (password.length < PASSWORD_MIN) return msg("policy.min", { n: PASSWORD_MIN });
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX) return msg("policy.tooLong");
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return msg("policy.letterDigit");
  if (password.toLowerCase().includes(username.toLowerCase()))
    return msg("policy.noId");
  return null;
}

// No 0/O, 1/l/I: temp passwords are read off printed slips.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Random one-time password handed to a user, who must replace it on first login. */
export function generateTempPassword(length = 10): string {
  let out = "";
  while (out.length < length) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  // Guarantee the result also satisfies the normal policy shape (letters + digits).
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + String(randomInt(2, 10));
  if (!/[A-Za-z]/.test(out)) out = "k" + out.slice(1);
  return out;
}

export function tempPasswordExpiry(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
