import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { db } from "../db";
import { config } from "../config";
import { requestMeta } from "../request";
import { generateToken, hashToken } from "./tokens";

const COOKIE = "classroom_session";
const DAY = 24 * 60 * 60 * 1000;

export type SessionUser = Pick<
  User,
  "id" | "username" | "fullName" | "email" | "role" | "mustChangePassword"
>;

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * DAY);
  const { ip, userAgent } = await requestMeta();
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, ip, userAgent },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Current user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          role: true,
          mustChangePassword: true,
          isActive: true,
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { isActive: _active, ...user } = session.user;
  return user;
});

/**
 * Require a logged-in user. Users still on a temporary password are sent to
 * /change-password unless the caller is the change-password flow itself.
 */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowMustChange) redirect("/change-password");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}

/** Log a user out everywhere, optionally keeping the session making this request. */
export async function destroyUserSessions(userId: string, keepCurrent = false): Promise<void> {
  const token = keepCurrent ? (await cookies()).get(COOKIE)?.value : undefined;
  await db.session.deleteMany({
    where: { userId, ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}) },
  });
}
