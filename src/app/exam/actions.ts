"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { asLanguage, cleanFiles } from "@/lib/code";
import { quizPhase, type Layout, type Response } from "@/lib/quiz";
import { asOptions, examBlockForAction, finalizeAttempt, isExpired, startAttempt } from "@/lib/quiz-server";

/** Start (or resume) the current cadet's attempt and open the exam page. */
export async function startQuizAction(quizId: string): Promise<{ error: string } | void> {
  const user = await requireUser();
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { questions: true } });
  const enrolled = await db.enrollment.findUnique({ where: { userId_offeringId: { userId: user.id, offeringId: quiz.offeringId } } });
  if (!enrolled || enrolled.role !== "STUDENT") return { error: "forbidden" };

  const existing = await db.quizAttempt.findUnique({ where: { quizId_studentId: { quizId, studentId: user.id } } });
  if (!existing && (quizPhase(quiz) !== "open" || quiz.questions.length === 0)) return { error: "closed" };
  const block = await examBlockForAction(quiz);
  if (block) return { error: block };

  const attempt = existing ?? (await startAttempt(quiz, user.id));
  if (!existing) await audit({ actorId: user.id, action: "quiz.started", targetType: "QuizAttempt", targetId: attempt.id });
  redirect(`/exam/${attempt.id}`);
}

async function ownAttempt(attemptId: string) {
  const user = await requireUser();
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
  if (!attempt || attempt.studentId !== user.id) throw new Error("forbidden");
  return attempt;
}

export type SaveResult = { ok: true } | { ok: false; reason: "closed" | "blocked" | "invalid" };

/** Autosave one answer. Rejected after the deadline (+ grace) or once submitted. */
export async function saveAnswerAction(attemptId: string, questionId: string, response: Response): Promise<SaveResult> {
  const attempt = await ownAttempt(attemptId);
  if (attempt.status !== "IN_PROGRESS") return { ok: false, reason: "closed" };
  if (isExpired(attempt)) {
    await finalizeAttempt(attempt.id, true);
    return { ok: false, reason: "closed" };
  }
  if (await examBlockForAction(attempt.quiz)) return { ok: false, reason: "blocked" };

  const layout = attempt.layout as Layout;
  if (!layout.questions.includes(questionId)) return { ok: false, reason: "invalid" };
  const q = await db.quizQuestion.findUnique({ where: { id: questionId } });
  if (!q) return { ok: false, reason: "invalid" };

  // Accept only what this question type can hold.
  let clean: Response;
  if (q.type === "SINGLE" || q.type === "MULTIPLE") {
    const valid = new Set(asOptions(q).map((o) => o.id));
    const choice = [...new Set((response.choice ?? []).map(String))].filter((id) => valid.has(id));
    clean = { choice: q.type === "SINGLE" ? choice.slice(0, 1) : choice };
  } else if (q.type === "CODE") {
    clean = { files: cleanFiles(asLanguage(q.language), response.files) };
  } else {
    clean = { text: String(response.text ?? "").slice(0, 50000) };
  }
  await db.quizAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, response: clean as Prisma.InputJsonValue },
    update: { response: clean as Prisma.InputJsonValue },
  });
  return { ok: true };
}

const EVENT_TYPES = new Set(["blur", "hidden", "fullscreen_exit", "copy", "paste", "contextmenu"]);

/** Integrity events batched from the exam page. */
export async function logEventsAction(attemptId: string, events: { type: string; at: number }[]): Promise<void> {
  const attempt = await ownAttempt(attemptId);
  if (attempt.status !== "IN_PROGRESS") return;
  const now = Date.now();
  const rows = events
    .filter((e) => EVENT_TYPES.has(e.type))
    .slice(0, 200)
    .map((e) => ({
      attemptId,
      type: e.type,
      // Trust the client clock only within the last hour; otherwise use server time.
      at: new Date(Math.abs(now - e.at) < 3600_000 ? e.at : now),
    }));
  if (rows.length) await db.quizEvent.createMany({ data: rows });
}

export async function submitAttemptAction(attemptId: string): Promise<{ ok: boolean }> {
  const attempt = await ownAttempt(attemptId);
  if (attempt.status === "IN_PROGRESS") {
    await finalizeAttempt(attempt.id, isExpired(attempt));
    await audit({ actorId: attempt.studentId, action: "quiz.submitted", targetType: "QuizAttempt", targetId: attempt.id });
  }
  return { ok: true };
}
