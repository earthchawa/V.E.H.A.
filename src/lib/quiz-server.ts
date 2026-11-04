import { headers } from "next/headers";
import type { Prisma, Quiz, QuizAttempt, QuizQuestion } from "@prisma/client";
import { db } from "./db";
import { requestMeta } from "./request";
import {
  GRACE_MS,
  attemptDeadline,
  attemptTotals,
  autoGrade,
  buildLayout,
  ipAllowed,
  sebOk,
  type Layout,
  type Option,
  type QuestionForGrading,
  type Response,
} from "./quiz";

export const asOptions = (q: Pick<QuizQuestion, "options">) => (q.options as Option[]) ?? [];
export const asAccepted = (q: Pick<QuizQuestion, "accepted">) => (q.accepted as string[]) ?? [];
export const forGrading = (q: QuizQuestion): QuestionForGrading => ({
  type: q.type,
  points: q.points,
  options: asOptions(q),
  accepted: asAccepted(q),
});

/** Keep the quiz's gradebook column in step with its questions (max = sum of points). */
export async function syncQuizGradeItem(quizId: string, categoryId?: string | null): Promise<void> {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { questions: true, gradeItem: true } });
  const maxPoints = quiz.questions.reduce((n, q) => n + q.points, 0);
  if (maxPoints <= 0) return;
  if (quiz.gradeItem) {
    await db.gradeItem.update({
      where: { id: quiz.gradeItem.id },
      data: { title: quiz.title, maxPoints, ...(categoryId !== undefined ? { categoryId } : {}) },
    });
  } else {
    const position = await db.gradeItem.count({ where: { offeringId: quiz.offeringId } });
    await db.gradeItem.create({
      data: { offeringId: quiz.offeringId, quizId, title: quiz.title, maxPoints, categoryId: categoryId ?? null, position },
    });
  }
}

/** Recompute an attempt's score and mirror it into the gradebook once every answer is graded. */
export async function recomputeAttempt(attemptId: string): Promise<void> {
  const attempt = await db.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, quiz: { include: { gradeItem: true } } },
  });
  if (attempt.status !== "SUBMITTED") return;
  const { score } = attemptTotals(attempt.answers, attempt.maxScore);
  await db.quizAttempt.update({ where: { id: attemptId }, data: { score } });
  const item = attempt.quiz.gradeItem;
  if (item) {
    await db.grade.upsert({
      where: { itemId_studentId: { itemId: item.id, studentId: attempt.studentId } },
      create: { itemId: item.id, studentId: attempt.studentId, points: score },
      update: { points: score },
    });
  }
}

/** Submit an attempt: grade every question (unanswered ones count as blank) and record the score. */
export async function finalizeAttempt(attemptId: string, auto: boolean): Promise<QuizAttempt> {
  const attempt = await db.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, quiz: { include: { questions: true } } },
  });
  if (attempt.status === "SUBMITTED") return attempt;
  const layout = attempt.layout as Layout;
  const byId = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  const answered = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const qid of layout.questions) {
    const q = byId.get(qid);
    if (!q) continue;
    const existing = answered.get(qid);
    const response = (existing?.response as Response) ?? {};
    const points = autoGrade(forGrading(q), response);
    if (existing) {
      ops.push(db.quizAnswer.update({ where: { id: existing.id }, data: { points, autoGraded: points != null } }));
    } else {
      ops.push(db.quizAnswer.create({ data: { attemptId, questionId: qid, response: {}, points, autoGraded: points != null } }));
    }
  }
  const now = new Date();
  ops.push(
    db.quizAttempt.update({
      where: { id: attemptId },
      data: { status: "SUBMITTED", submittedAt: now, autoSubmitted: auto },
    }),
    db.quizEvent.create({ data: { attemptId, type: auto ? "autosubmit" : "submit" } }),
  );
  await db.$transaction(ops);
  await recomputeAttempt(attemptId);
  return db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}

export function isExpired(a: Pick<QuizAttempt, "deadlineAt">, now = new Date()): boolean {
  return !!a.deadlineAt && now.getTime() > a.deadlineAt.getTime() + GRACE_MS;
}

/** Auto-submit any attempts of this quiz whose time is up (run lazily when pages load). */
export async function closeExpiredAttempts(quizId: string): Promise<void> {
  const open = await db.quizAttempt.findMany({ where: { quizId, status: "IN_PROGRESS" } });
  for (const a of open) if (isExpired(a)) await finalizeAttempt(a.id, true);
}

/** Re-grade automatically graded answers after a question's key changes. Manual grades are kept. */
export async function regradeQuestion(questionId: string): Promise<void> {
  const q = await db.quizQuestion.findUniqueOrThrow({ where: { id: questionId } });
  const answers = await db.quizAnswer.findMany({
    where: { questionId, attempt: { status: "SUBMITTED" } },
  });
  const touched = new Set<string>();
  for (const a of answers) {
    if (!a.autoGraded && a.points != null) continue; // a person graded it
    const points = autoGrade(forGrading(q), a.response as Response);
    await db.quizAnswer.update({ where: { id: a.id }, data: { points, autoGraded: points != null } });
    touched.add(a.attemptId);
  }
  for (const id of touched) await recomputeAttempt(id);
}

/** Keep each submitted attempt's max score equal to the quiz total after questions change. */
export async function refreshMaxScores(quizId: string): Promise<void> {
  const total = (await db.quizQuestion.aggregate({ where: { quizId }, _sum: { points: true } }))._sum.points ?? 0;
  await db.quizAttempt.updateMany({ where: { quizId }, data: { maxScore: total } });
}

// ---------- access checks ----------

export type Block = "seb" | "ip" | null;

/** SEB + network restrictions for a request to `path` (the page the cadet is on). */
export async function examBlock(quiz: Pick<Quiz, "requireSeb" | "sebConfigKeys" | "allowedIps">, path: string): Promise<Block> {
  const h = await headers();
  const { ip, userAgent } = await requestMeta();
  if (!ipAllowed(ip, quiz.allowedIps)) return "ip";
  if (quiz.requireSeb) {
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const ok = sebOk({
      url: `${proto}://${host}${path}`,
      userAgent,
      configKeyHash: h.get("x-safeexambrowser-configkeyhash"),
      keys: quiz.sebConfigKeys,
    });
    if (!ok) return "seb";
  }
  return null;
}

/** Lighter check for server actions (no reliable page URL): SEB header or user-agent must be present. */
export async function examBlockForAction(quiz: Pick<Quiz, "requireSeb" | "allowedIps">): Promise<Block> {
  const h = await headers();
  const { ip, userAgent } = await requestMeta();
  if (!ipAllowed(ip, quiz.allowedIps)) return "ip";
  if (quiz.requireSeb && !h.get("x-safeexambrowser-configkeyhash") && !/\bSEB\b|SafeExamBrowser/i.test(userAgent ?? "")) return "seb";
  return null;
}

/** Create the cadet's attempt (or return the existing one). */
export async function startAttempt(quiz: Quiz & { questions: QuizQuestion[] }, studentId: string): Promise<QuizAttempt> {
  const existing = await db.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId } } });
  if (existing) return existing;
  const now = new Date();
  const { ip, userAgent } = await requestMeta();
  const ordered = [...quiz.questions].sort((a, b) => a.position - b.position);
  const layout = buildLayout(
    ordered.map((q) => ({ id: q.id, options: asOptions(q) })),
    { shuffleQuestions: quiz.shuffleQuestions, shuffleOptions: quiz.shuffleOptions },
  );
  try {
    return await db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId,
        layout: layout as unknown as Prisma.InputJsonValue,
        deadlineAt: attemptDeadline(now, quiz.timeLimitMin, quiz.closesAt),
        maxScore: ordered.reduce((n, q) => n + q.points, 0),
        ip,
        userAgent,
        events: { create: { type: "start", details: { ip, userAgent } } },
      },
    });
  } catch {
    // Double click / two tabs: the unique (quiz, student) constraint means one attempt wins.
    return db.quizAttempt.findUniqueOrThrow({ where: { quizId_studentId: { quizId: quiz.id, studentId } } });
  }
}
