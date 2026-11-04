import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "./auth/session";
import { canGrade, offeringAccess } from "./access";
import { db } from "./db";

/** Load a course offering the current user may see, or 404. Cached per request (layout + page share it). */
export const loadCourse = cache(async (offeringId: string) => {
  const user = await requireUser();
  const access = await offeringAccess(user, offeringId);
  if (!access) notFound();
  const offering = await db.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: true,
      term: true,
      enrollments: {
        include: { user: { select: { id: true, username: true, fullName: true } } },
        orderBy: { user: { username: "asc" } },
      },
    },
  });
  if (!offering) notFound();
  return {
    user,
    offering,
    canManage: access === "manage",
    /** Only the course's instructors may change grades. */
    canGrade: await canGrade(user, offeringId),
    instructors: offering.enrollments.filter((e) => e.role === "INSTRUCTOR"),
    students: offering.enrollments.filter((e) => e.role === "STUDENT"),
  };
});
