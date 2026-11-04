import { db } from "../db";
import { config } from "../config";
import { audit } from "../audit";
import { sendMail } from "../mail";
import { brand } from "../brand";
import {
  checkPasswordPolicy,
  generateTempPassword,
  hashPassword,
  tempPasswordExpiry,
  verifyPassword,
} from "./password";
import { afterFailedLogin, loginBlock } from "./lockout";
import { generateToken, hashToken } from "./tokens";

// Compared against when the username does not exist, so response time does not reveal valid IDs.
const DUMMY_HASH = "$2b$12$gldsCiRbDbhCjErt2fmYQOXKwLJb0W7BXoE1XbNJ2WbyeVbAb3s3u";

export type LoginResult =
  | { ok: true; userId: string; mustChangePassword: boolean }
  | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = "Incorrect ID or password.";

export async function authenticate(usernameRaw: string, password: string): Promise<LoginResult> {
  const username = usernameRaw.trim();
  const now = new Date();
  const user = username ? await db.user.findUnique({ where: { username } }) : null;

  if (!user || !user.isActive) {
    await verifyPassword(password, DUMMY_HASH);
    await audit({ action: "login.failed", details: { username } });
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const block = loginBlock(user, now);
  if (block === "locked") {
    return {
      ok: false,
      error: `Too many failed attempts. Your account is locked for ${config.lockoutMinutes} minutes.`,
    };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const next = afterFailedLogin(user.failedLoginCount, now, config.maxFailedLogins, config.lockoutMinutes);
    await db.user.update({ where: { id: user.id }, data: next });
    await audit({ actorId: user.id, action: next.lockedUntil ? "login.locked" : "login.failed" });
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  // Only reveal temp-password expiry after a correct password.
  if (block === "temp-expired") {
    return {
      ok: false,
      error: "Your temporary password has expired. Ask your instructor or an administrator for a new one.",
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  await audit({ actorId: user.id, action: "login.success" });
  return { ok: true, userId: user.id, mustChangePassword: user.mustChangePassword };
}

/** User sets a new password while logged in (first-login or voluntary change). */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  email?: string | null,
): Promise<string | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return "Current password is incorrect.";
  const policy = checkPasswordPolicy(newPassword, user.username);
  if (policy) return policy;
  if (await verifyPassword(newPassword, user.passwordHash)) return "New password must be different from the current one.";

  if (email !== undefined && email !== null && email !== user.email) {
    const taken = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (taken) return "That email is already used by another account.";
  }

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      passwordChangedAt: new Date(),
      ...(email !== undefined ? { email } : {}),
    },
  });
  await audit({ actorId: userId, action: "password.changed" });
  return null;
}

/** Admin/instructor issues a fresh temporary password. Returns it so it can be shown once. */
export async function issueTempPassword(actorId: string, userId: string): Promise<string> {
  const temp = generateTempPassword();
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(temp),
      mustChangePassword: true,
      tempPasswordExpiresAt: tempPasswordExpiry(config.tempPasswordDays),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await db.session.deleteMany({ where: { userId } });
  await audit({ actorId, action: "password.admin_reset", targetType: "User", targetId: userId });
  return temp;
}

/**
 * Self-service "forgot password": email a one-time link to the address on file.
 * Always behaves the same from the outside so it cannot be used to probe accounts.
 */
export async function requestPasswordReset(usernameRaw: string): Promise<void> {
  const username = usernameRaw.trim();
  const user = username ? await db.user.findUnique({ where: { username } }) : null;
  if (!user || !user.isActive || !user.email) {
    await audit({ action: "password.reset_requested.ignored", details: { username } });
    return;
  }

  const recent = await db.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= config.maxResetRequestsPerHour) return;

  const token = generateToken();
  await db.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + config.resetTokenMinutes * 60_000),
    },
  });
  const link = `${config.appUrl}/reset-password?token=${token}`;
  await sendMail(
    user.email,
    `Reset your ${brand.name} password`,
    `Hello ${user.fullName},\n\nA password reset was requested for account ${user.username}.\n` +
      `Open this link within ${config.resetTokenMinutes} minutes to choose a new password:\n${link}\n\n` +
      `If you didn't request this, ignore this email — your current password still works.\n\n— ${brand.name} · ${brand.tagline}`,
  );
  await audit({ actorId: user.id, action: "password.reset_requested" });
}

export async function findValidResetToken(token: string) {
  if (!token) return null;
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, username: true, isActive: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) return null;
  return record;
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<string | null> {
  const record = await findValidResetToken(token);
  if (!record) return "This link is invalid or has expired. Please request a new one.";
  const policy = checkPasswordPolicy(newPassword, record.user.username);
  if (policy) return policy;

  const now = new Date();
  // Mark the token used first so a double-submit cannot reuse it.
  const claimed = await db.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return "This link has already been used.";

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    // Invalidate other outstanding links and every existing login.
    db.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    }),
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ actorId: record.userId, action: "password.reset_completed" });
  return null;
}

export async function updateOwnEmail(userId: string, currentPassword: string, email: string | null): Promise<string | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return "Current password is incorrect.";
  if (email) {
    const taken = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (taken) return "That email is already used by another account.";
  }
  await db.user.update({ where: { id: userId }, data: { email } });
  await audit({ actorId: userId, action: "email.changed" });
  return null;
}
