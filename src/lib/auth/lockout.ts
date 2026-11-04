/** Pure login-policy decisions, kept separate so they can be unit tested. */

export type LoginBlock = "locked" | "temp-expired" | null;

export function loginBlock(
  user: { lockedUntil: Date | null; mustChangePassword: boolean; tempPasswordExpiresAt: Date | null },
  now: Date,
): LoginBlock {
  if (user.lockedUntil && user.lockedUntil > now) return "locked";
  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < now)
    return "temp-expired";
  return null;
}

/** State to store after a wrong password. */
export function afterFailedLogin(
  failedLoginCount: number,
  now: Date,
  maxFailed: number,
  lockoutMinutes: number,
): { failedLoginCount: number; lockedUntil: Date | null } {
  const next = failedLoginCount + 1;
  if (next >= maxFailed) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + lockoutMinutes * 60_000) };
  }
  return { failedLoginCount: next, lockedUntil: null };
}
