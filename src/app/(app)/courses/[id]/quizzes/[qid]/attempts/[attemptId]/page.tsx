import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { formatPoints } from "@/lib/grades";
import { attemptTotals, type Layout, type Response } from "@/lib/quiz";
import { asAccepted, asOptions, closeExpiredAttempts } from "@/lib/quiz-server";
import type { Key } from "@/lib/i18n";
import { AnswerView } from "@/components/AnswerView";
import { GradeAnswers } from "../../../GradeAnswers";
import { resetAttemptAction } from "../../../actions";
import { ConfirmButton } from "../../../../grades/ConfirmButton";

export default async function AttemptPage({ params }: { params: Promise<{ id: string; qid: string; attemptId: string }> }) {
  const { id, qid, attemptId } = await params;
  const { offering, canManage } = await loadCourse(id);
  if (!canManage) notFound();
  const { t, date } = await getI18n();
  await closeExpiredAttempts(qid);

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      student: { select: { username: true, fullName: true } },
      quiz: { include: { questions: true } },
      answers: true,
      events: { where: { type: { not: "open" } }, orderBy: { at: "asc" } },
    },
  });
  if (!attempt || attempt.quizId !== qid || attempt.quiz.offeringId !== offering.id) notFound();
  const layout = attempt.layout as Layout;
  const qById = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  const aById = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const totals = attemptTotals(attempt.answers, attempt.maxScore);
  const base = `/courses/${offering.id}/quizzes/${qid}`;
  const labels = { noAnswer: t("qz.noAnswer"), correctAnswer: t("qz.correctAnswer") };
  const flagged = (type: string) => !["start", "submit", "autosubmit"].includes(type);

  return (
    <div>
      <Link href={`${base}/results`} className="text-xs text-muted transition hover:text-fg">← {t("qz.results")}</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{attempt.student.fullName}</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono text-xs">{attempt.student.username}</span> · {attempt.quiz.title}
            {attempt.submittedAt && <> · {t("asg.submittedAt", { date: date(attempt.submittedAt) })}</>}
          </p>
        </div>
        {attempt.status === "SUBMITTED" && (
          <div className="font-mono text-2xl font-semibold" data-testid="attempt-total">
            {formatPoints(totals.score ?? totals.partial)}{totals.score == null && "*"} <span className="text-base text-subtle">/ {formatPoints(attempt.maxScore)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="min-w-0">
          {attempt.status === "SUBMITTED" ? (
            <GradeAnswers
              quizId={qid}
              rows={layout.questions
                .map((qId, i) => ({ q: qById.get(qId), a: aById.get(qId), i }))
                .filter((x): x is { q: NonNullable<typeof x.q>; a: NonNullable<typeof x.a>; i: number } => !!x.q && !!x.a)
                .map(({ q, a, i }) => ({
                  answerId: a.id,
                  heading: (
                    <>
                      <span className="text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
                      <span className="badge bg-surface-3 text-muted">{t(`qz.type.${q.type}`)}</span>
                      <span className="w-full whitespace-pre-wrap text-sm">{q.prompt}</span>
                    </>
                  ),
                  body: (
                    <AnswerView type={q.type} options={asOptions(q)} accepted={asAccepted(q)} codeAnswer={q.codeAnswer} response={a.response as Response} showKey labels={labels} />
                  ),
                  maxPoints: q.points,
                  points: a.points,
                  feedback: a.feedback,
                  autoGraded: a.autoGraded,
                }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("qz.status.inProgress")}</p>
          )}
        </section>
        <aside className="space-y-6">
          <section className="card">
            <h3 className="card-title">{t("qz.integrityLog")}</h3>
            {attempt.events.length === 0 ? (
              <p className="text-sm text-muted">{t("qz.noEvents")}</p>
            ) : (
              <ol className="space-y-2 text-sm" data-testid="event-log">
                {attempt.events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="shrink-0 font-mono text-xs text-subtle">
                      {e.at.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })}
                    </span>
                    <span className={flagged(e.type) ? "text-warning" : "text-muted"}>{t(`qz.ev.${e.type}` as Key)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <ConfirmButton action={resetAttemptAction} name="attemptId" value={attempt.id} message={t("qz.resetConfirm")} label={t("qz.resetAttempt")} />
        </aside>
      </div>
    </div>
  );
}
