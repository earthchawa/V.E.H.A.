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

/**
 * Grading (scores, gradebook setup, quiz marking) is for the course's own instructors only.
 * Admins manage courses but can only view and export grades.
 */
export async function canGrade(user: SessionUser, offeringId: string): Promise<boolean> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_offeringId: { userId: user.id, offeringId } },
  });
  return enrollment?.role === "INSTRUCTOR";
}
