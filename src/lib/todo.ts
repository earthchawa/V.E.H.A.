import { db } from "./db";
import { acceptsSubmissions } from "./assignments";

const HIGH_SIMILARITY = 0.4;
const SOON_DAYS = 7;

export type InstructorTodo = {
  offeringId: string;
  courseId: string;
  courseCode: string;
  section: string;
  assignmentId: string;
  title: string;
  ungraded: number;
  highSimilarity: number;
  dueSoon: Date | null;
  submitted: number;
  total: number;
};

/** Work waiting for an instructor across every course they teach in a term. */
export async function instructorTodo(userId: string, termId: string, now = new Date()): Promise<InstructorTodo[]> {
  const soon = new Date(now.getTime() + SOON_DAYS * 86400_000);
  const assignments = await db.assignment.findMany({
    where: { offering: { termId, enrollments: { some: { userId, role: "INSTRUCTOR" } } } },
    include: {
      offering: { select: { id: true, section: true, courseId: true, course: { select: { code: true } }, _count: { select: { enrollments: { where: { role: "STUDENT" } } } } } },
      submissions: { select: { studentId: true, similarity: true } },
      gradeItem: { select: { grades: { where: { points: { not: null } }, select: { studentId: true } } } },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
  });

  return assignments
    .map((a) => {
      const graded = new Set(a.gradeItem?.grades.map((g) => g.studentId) ?? []);
      return {
        offeringId: a.offering.id,
        courseId: a.offering.courseId,
        courseCode: a.offering.course.code,
        section: a.offering.section,
        assignmentId: a.id,
        title: a.title,
        ungraded: a.gradeItem ? a.submissions.filter((s) => !graded.has(s.studentId)).length : 0,
        highSimilarity: a.checkSimilarity ? a.submissions.filter((s) => (s.similarity ?? 0) >= HIGH_SIMILARITY).length : 0,
        dueSoon: a.dueAt && a.dueAt >= now && a.dueAt <= soon ? a.dueAt : null,
        submitted: a.submissions.length,
        total: a.offering._count.enrollments,
      };
    })
    .filter((r) => r.ungraded > 0 || r.highSimilarity > 0 || r.dueSoon);
}

export type CadetTodo = {
  offeringId: string;
  courseCode: string;
  assignmentId: string;
  title: string;
  dueAt: Date | null;
  overdue: boolean;
};

/** Open assignments a cadet hasn't submitted yet, soonest first. */
export async function cadetTodo(userId: string, termId: string, now = new Date()): Promise<CadetTodo[]> {
  const assignments = await db.assignment.findMany({
    where: {
      isPublished: true,
      offering: { termId, enrollments: { some: { userId, role: "STUDENT" } } },
      submissions: { none: { studentId: userId } },
    },
    include: { offering: { select: { id: true, course: { select: { code: true } } } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
  });
  return assignments
    .filter((a) => acceptsSubmissions(a, now))
    .slice(0, 8)
    .map((a) => ({
      offeringId: a.offering.id,
      courseCode: a.offering.course.code,
      assignmentId: a.id,
      title: a.title,
      dueAt: a.dueAt,
      overdue: !!a.dueAt && a.dueAt < now,
    }));
}

export type QuizTodo = { offeringId: string; courseId: string; courseCode: string; section: string; quizId: string; title: string; toGrade: number; closesAt: Date | null };

/** Quizzes with hand-graded answers waiting, across courses the instructor teaches. */
export async function instructorQuizTodo(userId: string, termId: string): Promise<QuizTodo[]> {
  const quizzes = await db.quiz.findMany({
    where: { offering: { termId, enrollments: { some: { userId, role: "INSTRUCTOR" } } } },
    include: { offering: { select: { id: true, courseId: true, section: true, course: { select: { code: true } } } } },
  });
  const out: QuizTodo[] = [];
  for (const q of quizzes) {
    const toGrade = await db.quizAnswer.count({ where: { points: null, attempt: { quizId: q.id, status: "SUBMITTED" } } });
    if (toGrade)
      out.push({ offeringId: q.offering.id, courseId: q.offering.courseId, courseCode: q.offering.course.code, section: q.offering.section, quizId: q.id, title: q.title, toGrade, closesAt: q.closesAt });
  }
  return out;
}

/** Open quizzes the cadet hasn't submitted. */
export async function cadetQuizTodo(userId: string, termId: string, now = new Date()): Promise<QuizTodo[]> {
  const quizzes = await db.quiz.findMany({
    where: {
      isPublished: true,
      offering: { termId, enrollments: { some: { userId, role: "STUDENT" } } },
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gt: now } }] }],
      attempts: { none: { studentId: userId, status: "SUBMITTED" } },
    },
    include: { offering: { select: { id: true, courseId: true, section: true, course: { select: { code: true } } } } },
    orderBy: { closesAt: { sort: "asc", nulls: "last" } },
  });
  return quizzes.map((q) => ({ offeringId: q.offering.id, courseId: q.offering.courseId, courseCode: q.offering.course.code, section: q.offering.section, quizId: q.id, title: q.title, toGrade: 0, closesAt: q.closesAt }));
}
