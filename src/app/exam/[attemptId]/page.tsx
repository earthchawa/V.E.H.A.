import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requestMeta } from "@/lib/request";
import type { Layout, Response } from "@/lib/quiz";
import { asOptions, examBlock, finalizeAttempt, isExpired } from "@/lib/quiz-server";
import { Logo } from "@/components/Logo";
import { ExamClient, type ExamQuestion } from "./ExamClient";

export async function generateMetadata() {
  return { title: (await getI18n()).t("course.tab.quizzes") };
}

/** Distraction-free exam page (no site navigation). */
export default async function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser();
  const { t, date } = await getI18n();

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: true, offering: { include: { course: true } } } }, answers: true },
  });
  if (!attempt || attempt.studentId !== user.id) notFound();
  const quiz = attempt.quiz;
  const quizHref = `/courses/${quiz.offeringId}/quizzes/${quiz.id}`;

  if (attempt.status === "SUBMITTED") redirect(quizHref);
  if (isExpired(attempt)) {
    await finalizeAttempt(attempt.id, true);
    redirect(`${quizHref}?auto=1`);
  }

  const block = await examBlock(quiz, `/exam/${attempt.id}`);
  if (block) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <Logo size="lg" />
          <p className="text-sm text-muted" data-testid="exam-blocked">{t(block === "seb" ? "qz.blocked.seb" : "qz.blocked.ip")}</p>
        </div>
      </main>
    );
  }

  // Integrity: every page load is noted ("open", not shown); any load after the first is a reload,
  // and a change of device/network mid-attempt is flagged separately.
  const { ip, userAgent } = await requestMeta();
  const previousLoads = await db.quizEvent.count({ where: { attemptId: attempt.id, type: "open" } });
  await db.quizEvent.create({ data: { attemptId: attempt.id, type: "open" } });
  if (previousLoads > 0) {
    const moved = (attempt.ip && ip && attempt.ip !== ip) || (attempt.userAgent && userAgent && attempt.userAgent !== userAgent);
    await db.quizEvent.create({
      data: { attemptId: attempt.id, type: moved ? "device" : "resume", details: moved ? { ip, userAgent } : undefined },
    });
    if (moved) await db.quizAttempt.update({ where: { id: attempt.id }, data: { ip, userAgent } });
  }

  const layout = attempt.layout as Layout;
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const questions: ExamQuestion[] = layout.questions
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => {
      const opts = new Map(asOptions(q).map((o) => [o.id, o]));
      const order = layout.options[q.id] ?? [...opts.keys()];
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        codeAnswer: q.codeAnswer,
        // Never send which option is correct.
        options: [...order, ...[...opts.keys()].filter((k) => !order.includes(k))]
          .map((id) => opts.get(id))
          .filter((o): o is NonNullable<typeof o> => !!o)
          .map((o) => ({ id: o.id, text: o.text })),
      };
    });
  const initial = Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.response as Response]));

  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo />
          <span className="text-subtle">/</span>
          <span className="truncate text-sm font-medium">{quiz.title}</span>
          <span className="ml-auto font-mono text-xs text-subtle">{quiz.offering.course.code} · {user.username}</span>
        </div>
        {(quiz.instructions || attempt.deadlineAt) && (
          <div className="mx-auto max-w-3xl px-4 pb-3 text-xs text-muted">
            {attempt.deadlineAt && <span>{t("qz.closes", { date: date(attempt.deadlineAt) })}</span>}
          </div>
        )}
      </header>
      <ExamClient
        attemptId={attempt.id}
        questions={questions}
        initial={initial}
        deadline={attempt.deadlineAt?.toISOString() ?? null}
        serverNow={new Date().toISOString()}
        doneHref={quizHref}
      />
    </main>
  );
}
