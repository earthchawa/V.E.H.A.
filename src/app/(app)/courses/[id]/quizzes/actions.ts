"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import type { Prisma, QuestionType } from "@prisma/client";
import type { FormState } from "@/lib/form";
import { requireUser } from "@/lib/auth/session";
import { canGrade, offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getI18n } from "@/lib/i18n/server";
import { parseBangkokLocal } from "@/lib/assignments";
import type { Option } from "@/lib/quiz";
import { recomputeAttempt, refreshMaxScores, regradeQuestion, syncQuizGradeItem } from "@/lib/quiz-server";

async function requireManage(offeringId: string) {
  const user = await requireUser();
  if ((await offeringAccess(user, offeringId)) !== "manage") throw new Error("forbidden");
  return user;
}

/** Marking answers and resetting attempts: the course's instructors only. */
async function quizForGrading(quizId: string) {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
  const user = await requireUser();
  if (!(await canGrade(user, quiz.offeringId))) throw new Error("forbidden");
  return { quiz, user };
}

async function quizFor(quizId: string) {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
  const user = await requireManage(quiz.offeringId);
  return { quiz, user };
}

const refresh = (offeringId: string) => revalidatePath(`/courses/${offeringId}`, "layout");
const RESULTS = ["HIDDEN", "SCORE", "FULL"] as const;

// ---------- quiz settings ----------

export async function saveQuizAction(offeringId: string, quizId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();

  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: t("err.titleRequired") };
  const opensRaw = String(fd.get("opensAt") ?? "");
  const closesRaw = String(fd.get("closesAt") ?? "");
  const opensAt = parseBangkokLocal(opensRaw);
  const closesAt = parseBangkokLocal(closesRaw);
  if ((opensRaw && !opensAt) || (closesRaw && !closesAt)) return { error: t("err.dueInvalid") };
  if (opensAt && closesAt && closesAt <= opensAt) return { error: t("err.window") };
  const limitRaw = String(fd.get("timeLimitMin") ?? "").trim();
  const timeLimitMin = limitRaw ? Number(limitRaw) : null;
  if (timeLimitMin != null && (!Number.isInteger(timeLimitMin) || timeLimitMin <= 0 || timeLimitMin > 600)) return { error: t("err.timeLimit") };
  const results = String(fd.get("results"));
  const isPublished = fd.get("isPublished") === "on";

  const data = {
    title,
    instructions: String(fd.get("instructions") ?? "").trim().slice(0, 20000) || null,
    opensAt,
    closesAt,
    timeLimitMin,
    shuffleQuestions: fd.get("shuffleQuestions") === "on",
    shuffleOptions: fd.get("shuffleOptions") === "on",
    isPublished,
    results: (RESULTS as readonly string[]).includes(results) ? (results as (typeof RESULTS)[number]) : "SCORE",
    requireSeb: fd.get("requireSeb") === "on",
  };
  // Exam rooms: only when "only in these rooms" is chosen, and only rooms that exist.
  const wanted = fd.get("where") === "rooms" ? fd.getAll("networkId").map(String) : [];
  const networks = wanted.length ? await db.examNetwork.findMany({ where: { id: { in: wanted } }, select: { id: true } }) : [];
  const catRaw = String(fd.get("categoryId") ?? "");
  const cat = catRaw ? await db.gradeCategory.findUnique({ where: { id: catRaw } }) : null;
  const categoryId = cat && cat.offeringId === offeringId ? cat.id : null;

  if (quizId) {
    const existing = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { _count: { select: { questions: true } } } });
    if (existing.offeringId !== offeringId) throw new Error("forbidden");
    if (isPublished && existing._count.questions === 0) return { error: t("err.noQuestionsToPublish") };
    await db.quiz.update({ where: { id: quizId }, data: { ...data, networks: { set: networks } } });
    await syncQuizGradeItem(quizId, categoryId);
    await audit({ actorId: user.id, action: "quiz.updated", targetType: "Quiz", targetId: quizId });
    refresh(offeringId);
    return { success: t("ok.saved") };
  }

  // New quizzes start as drafts until they have questions.
  const created = await db.quiz.create({
    data: { ...data, isPublished: false, offeringId, createdById: user.id, networks: { connect: networks } },
  });
  await audit({ actorId: user.id, action: "quiz.created", targetType: "Quiz", targetId: created.id });
  redirect(`/courses/${offeringId}/quizzes/${created.id}`);
}

export async function deleteQuizAction(fd: FormData): Promise<void> {
  const { quiz, user } = await quizFor(String(fd.get("quizId")));
  await db.quiz.delete({ where: { id: quiz.id } });
  await audit({ actorId: user.id, action: "quiz.deleted", targetType: "Quiz", targetId: quiz.id, details: { title: quiz.title } });
  redirect(`/courses/${quiz.offeringId}/quizzes`);
}

// ---------- questions ----------

const TYPES: QuestionType[] = ["SINGLE", "MULTIPLE", "SHORT", "ESSAY"];

export async function saveQuestionAction(quizId: string, questionId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { quiz, user } = await quizFor(quizId);
  const { t } = await getI18n();

  const type = String(fd.get("type")) as QuestionType;
  if (!TYPES.includes(type)) return { error: t("common.invalid") };
  const prompt = String(fd.get("prompt") ?? "").trim().slice(0, 20000);
  if (!prompt) return { error: t("err.promptRequired") };
  const points = Number(fd.get("points"));
  if (!Number.isFinite(points) || points <= 0 || points > 1000) return { error: t("err.points") };

  let options: Option[] = [];
  if (type === "SINGLE" || type === "MULTIPLE") {
    const texts = fd.getAll("optText").map((v) => String(v).trim().slice(0, 2000));
    const ids = fd.getAll("optId").map(String);
    const correct = new Set(fd.getAll("optCorrect").map(String));
    options = texts
      .map((text, i) => ({ id: ids[i] || randomUUID().slice(0, 8), text, correct: correct.has(String(i)) }))
      .filter((o) => o.text);
    if (options.length < 2) return { error: t("err.needOptions") };
    const nCorrect = options.filter((o) => o.correct).length;
    if (nCorrect === 0) return { error: t("err.needCorrect") };
    if (type === "SINGLE" && nCorrect !== 1) return { error: t("err.singleOneCorrect") };
  }
  const accepted =
    type === "SHORT"
      ? String(fd.get("accepted") ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50)
      : [];

  const data = {
    type,
    prompt,
    points,
    options: options as unknown as Prisma.InputJsonValue,
    accepted: accepted as Prisma.InputJsonValue,
    codeAnswer: type === "ESSAY" && fd.get("codeAnswer") === "on",
  };

  let id = questionId;
  if (questionId) {
    const q = await db.quizQuestion.findUniqueOrThrow({ where: { id: questionId } });
    if (q.quizId !== quizId) throw new Error("forbidden");
    await db.quizQuestion.update({ where: { id: questionId }, data });
  } else {
    const position = await db.quizQuestion.count({ where: { quizId } });
    id = (await db.quizQuestion.create({ data: { ...data, quizId, position } })).id;
  }
  await refreshMaxScores(quizId);
  await regradeQuestion(id!);
  await syncQuizGradeItem(quizId);
  await audit({ actorId: user.id, action: questionId ? "quiz.question_updated" : "quiz.question_added", targetType: "QuizQuestion", targetId: id! });
  refresh(quiz.offeringId);
  return { success: t("ok.saved") };
}

export async function deleteQuestionAction(fd: FormData): Promise<void> {
  const q = await db.quizQuestion.findUniqueOrThrow({ where: { id: String(fd.get("questionId")) } });
  const { quiz, user } = await quizFor(q.quizId);
  await db.quizQuestion.delete({ where: { id: q.id } });
  // Close the gap in positions.
  const rest = await db.quizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: "asc" } });
  await db.$transaction(rest.map((r, i) => db.quizQuestion.update({ where: { id: r.id }, data: { position: i } })));
  await refreshMaxScores(quiz.id);
  const attempts = await db.quizAttempt.findMany({ where: { quizId: quiz.id, status: "SUBMITTED" }, select: { id: true } });
  for (const a of attempts) await recomputeAttempt(a.id);
  await syncQuizGradeItem(quiz.id);
  await audit({ actorId: user.id, action: "quiz.question_deleted", targetType: "Quiz", targetId: quiz.id });
  refresh(quiz.offeringId);
}

export async function moveQuestionAction(fd: FormData): Promise<void> {
  const q = await db.quizQuestion.findUniqueOrThrow({ where: { id: String(fd.get("questionId")) } });
  const { quiz } = await quizFor(q.quizId);
  const all = await db.quizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: "asc" } });
  const i = all.findIndex((x) => x.id === q.id);
  const j = fd.get("dir") === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((r, k) => db.quizQuestion.update({ where: { id: r.id }, data: { position: k } })));
  refresh(quiz.offeringId);
}

// ---------- grading ----------

export type AnswerGrade = { answerId: string; points: number | null; feedback: string | null };

export async function gradeAnswersAction(quizId: string, changes: AnswerGrade[]): Promise<FormState> {
  const { quiz, user } = await quizForGrading(quizId);
  const { t } = await getI18n();
  if (!changes.length) return { success: t("ok.gradesSaved", { n: 0 }) };

  const answers = await db.quizAnswer.findMany({
    where: { id: { in: changes.map((c) => c.answerId) } },
    include: { question: true, attempt: { select: { quizId: true } } },
  });
  const byId = new Map(answers.map((a) => [a.id, a]));
  for (const c of changes) {
    const a = byId.get(c.answerId);
    if (!a || a.attempt.quizId !== quizId) return { error: t("common.invalid") };
    if (c.points != null && (!Number.isFinite(c.points) || c.points < 0 || c.points > a.question.points))
      return { error: t("gr.invalidScore", { title: a.question.prompt.slice(0, 40), max: a.question.points }) };
  }
  await db.$transaction(
    changes.map((c) =>
      db.quizAnswer.update({
        where: { id: c.answerId },
        data: { points: c.points, feedback: c.feedback?.slice(0, 5000) || null, autoGraded: false, gradedById: user.id },
      }),
    ),
  );
  const attempts = new Set(answers.map((a) => a.attemptId));
  for (const id of attempts) await recomputeAttempt(id);
  await audit({
    actorId: user.id,
    action: "quiz.graded",
    targetType: "Quiz",
    targetId: quizId,
    details: changes.map((c) => ({ answer: c.answerId, from: byId.get(c.answerId)!.points, to: c.points })),
  });
  refresh(quiz.offeringId);
  return { success: t("ok.gradesSaved", { n: changes.length }) };
}

/** Delete an attempt so the cadet can start over (e.g. their laptop failed). */
export async function resetAttemptAction(fd: FormData): Promise<void> {
  const attempt = await db.quizAttempt.findUniqueOrThrow({ where: { id: String(fd.get("attemptId")) }, include: { quiz: { include: { gradeItem: true } } } });
  const { user } = await quizForGrading(attempt.quizId);
  await db.quizAttempt.delete({ where: { id: attempt.id } });
  if (attempt.quiz.gradeItem)
    await db.grade.deleteMany({ where: { itemId: attempt.quiz.gradeItem.id, studentId: attempt.studentId } });
  await audit({ actorId: user.id, action: "quiz.attempt_reset", targetType: "QuizAttempt", targetId: attempt.id, details: { student: attempt.studentId } });
  refresh(attempt.quiz.offeringId);
  redirect(`/courses/${attempt.quiz.offeringId}/quizzes/${attempt.quizId}/results`);
}

/** Drag-and-drop reorder: the full list of question ids in their new order. */
export async function reorderQuestionsAction(quizId: string, ids: string[]): Promise<void> {
  const { quiz } = await quizFor(quizId);
  const existing = await db.quizQuestion.findMany({ where: { quizId }, select: { id: true } });
  const valid = new Set(existing.map((q) => q.id));
  if (ids.length !== valid.size || !ids.every((id) => valid.has(id))) return;
  await db.$transaction(ids.map((id, position) => db.quizQuestion.update({ where: { id }, data: { position } })));
  refresh(quiz.offeringId);
}
