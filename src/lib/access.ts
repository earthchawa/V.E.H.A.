import type { SessionUser } from "./auth/session";
import { db } from "./db";

/** How the user relates to a course offering: null means no access. */
export async function offeringAccess(
  user: SessionUser,
  offeringId: string,
): Promise<"manage" | "view" | null> {
  if (user.role === "ADMIN") return "manage";
  const enrollment = await db.enrollment.findUnique({
    where: { userId_offeringId: { userId: user.id, offeringId } },
  });
  if (!enrollment) return null;
  return enrollment.role === "INSTRUCTOR" ? "manage" : "view";
}
