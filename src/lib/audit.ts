import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { requestMeta } from "./request";

type Entry = {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  /** Pass when the target is already deleted, so the entry still gets its course and department. */
  offeringId?: string;
};

/** The course section a target belongs to, if any (so logs can be filtered by course and department). */
async function offeringOf(type?: string, id?: string): Promise<string | null> {
  if (!type || !id) return null;
  const pick = (row: { offeringId: string } | null) => row?.offeringId ?? null;
  switch (type) {
    case "CourseOffering":
      return id;
    case "Material":
      return pick(await db.material.findUnique({ where: { id }, select: { offeringId: true } }));
    case "Assignment":
      return pick(await db.assignment.findUnique({ where: { id }, select: { offeringId: true } }));
    case "Submission":
      return pick((await db.submission.findUnique({ where: { id }, select: { assignment: { select: { offeringId: true } } } }))?.assignment ?? null);
    case "Quiz":
      return pick(await db.quiz.findUnique({ where: { id }, select: { offeringId: true } }));
    case "QuizQuestion":
      return pick((await db.quizQuestion.findUnique({ where: { id }, select: { quiz: { select: { offeringId: true } } } }))?.quiz ?? null);
    case "QuizAttempt":
      return pick((await db.quizAttempt.findUnique({ where: { id }, select: { quiz: { select: { offeringId: true } } } }))?.quiz ?? null);
    case "GradeCategory":
      return pick(await db.gradeCategory.findUnique({ where: { id }, select: { offeringId: true } }));
    case "GradeItem":
      return pick(await db.gradeItem.findUnique({ where: { id }, select: { offeringId: true } }));
    default:
      return null;
  }
}

/**
 * Department an entry concerns: the course's department when it is about a course,
 * otherwise the department of the user it is about (target user, else the actor).
 */
async function departmentOf(e: Entry, offeringId: string | null): Promise<string | null> {
  if (offeringId) {
    const o = await db.courseOffering.findUnique({ where: { id: offeringId }, select: { course: { select: { departmentId: true } } } });
    return o?.course.departmentId ?? null;
  }
  if (e.targetType === "Course" && e.targetId) {
    return (await db.course.findUnique({ where: { id: e.targetId }, select: { departmentId: true } }))?.departmentId ?? null;
  }
  const userId = e.targetType === "User" && e.targetId ? e.targetId : e.actorId;
  if (!userId) return null;
  return (await db.user.findUnique({ where: { id: userId }, select: { departmentId: true } }))?.departmentId ?? null;
}

export async function audit(entry: Entry): Promise<void> {
  const { ip } = await requestMeta();
  let offeringId: string | null = null;
  let departmentId: string | null = null;
  try {
    offeringId = entry.offeringId ?? (await offeringOf(entry.targetType, entry.targetId));
    departmentId = await departmentOf(entry, offeringId);
  } catch {
    // Scope is a convenience for filtering; never lose the log entry over it.
  }
  await db.auditLog.create({ data: { ...entry, ip, offeringId, departmentId } });
}
