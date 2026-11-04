import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { toBangkokLocal } from "@/lib/assignments";
import { formatPoints } from "@/lib/grades";
import { attemptTotals, quizPhase, resultsVisible, type Layout, type Response } from "@/lib/quiz";
import { asAccepted, asOptions, closeExpiredAttempts, examBlock } from "@/lib/quiz-server";
import { AnswerView } from "@/components/AnswerView";
import { QuizForm } from "../QuizForm";
import { QuestionList } from "../QuestionList";
import { QuestionEditor } from "../QuestionEditor";
import { StartButton } from "../StartButton";
import { deleteQuizAction } from "../actions";
import { ConfirmButton } from "../../grades/ConfirmButton";
import { Modal } from "@/components/Modal";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; qid: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id, qid } = await params;
  const { auto } = await searchParams;
  const { user, offering, canManage } = await loadCourse(id);
  const { t, tn, date } = await getI18n();

  const quiz = await db.quiz.findUnique({
    where: { id: qid },
    include: {
      questions: { orderBy: { position: "asc" } },
      gradeItem: true,
      networks: { select: { id: true, name: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz || quiz.offeringId !== offering.id || (!canManage && !quiz.isPublished)) notFound();
  await closeExpiredAttempts(quiz.id);
  const phase = quizPhase(quiz);
  const total = quiz.questions.reduce((n, q) => n + q.points, 0);
  const base = `/courses/${offering.id}/quizzes/${quiz.id}`;

  const header = (
    <div className="mb-6">
      <Link href={`/courses/${offering.id}/quizzes`} className="text-xs text-muted transition hover:text-fg">{t("qz.backToQuizzes")}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{quiz.title}</h2>
        <span className="badge bg-surface-3 text-muted">
          {phase === "upcoming" && quiz.opensAt ? t("qz.phase.upcoming", { date: date(quiz.opensAt) }) : t(`qz.phase.${phase}`)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {tn("qz.questions", quiz.questions.length)} · {t("qz.total", { n: formatPoints(total) })}
        {quiz.timeLimitMin && <> · {t("qz.minutes", { n: quiz.timeLimitMin })}</>}
        {quiz.closesAt && <> · {t("qz.closes", { date: date(quiz.closesAt) })}</>}
      </p>
    </div>
  );

  // ---------- Instructor: builder ----------
  if (canManage) {
    const [categories, networks] = await Promise.all([
      db.gradeCategory.findMany({ where: { offeringId: offering.id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
      db.examNetwork.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    const settingsForm = (
      <QuizForm
        offeringId={offering.id}
        quizId={quiz.id}
        categories={categories}
        networks={networks}
        closeOnSuccess
        defaults={{
          title: quiz.title,
          instructions: quiz.instructions ?? "",
          opensAt: toBangkokLocal(quiz.opensAt),
          closesAt: toBangkokLocal(quiz.closesAt),
          timeLimitMin: quiz.timeLimitMin ? String(quiz.timeLimitMin) : "",
          shuffleQuestions: quiz.shuffleQuestions,
          shuffleOptions: quiz.shuffleOptions,
          isPublished: quiz.isPublished,
          results: quiz.results,
          requireSeb: quiz.requireSeb,
          networkIds: quiz.networks.map((n) => n.id),
          categoryId: quiz.gradeItem?.categoryId ?? "",
        }}
      />
    );
    const row = (label: string, value: React.ReactNode) => (
      <div className="flex justify-between gap-3 py-1.5">
        <dt className="text-muted">{label}</dt>
        <dd className="text-right">{value}</dd>
      </div>
    );
    return (
      <div>
        {header}
        <div className="-mt-3 mb-6 flex flex-wrap gap-2">
          <Modal label={`+ ${t("qz.addQuestion")}`} title={t("qz.addQuestion")} size="lg" testId="add-question">
            <QuestionEditor quizId={quiz.id} closeOnSuccess />
          </Modal>
          <Modal label={t("qz.f.settings")} title={t("qz.f.settings")} buttonClassName="btn-secondary h-9" size="lg" testId="quiz-settings">
            {settingsForm}
          </Modal>
          <Link href={`${base}/results`} className="btn-secondary h-9">{t("qz.results")}</Link>
        </div>
        {quiz._count.attempts > 0 && (
          <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-warning">{t("qz.startedWarning")}</p>
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <section className="min-w-0">
            <QuestionList
              quizId={quiz.id}
              questions={quiz.questions.map((q) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                points: q.points,
                options: asOptions(q),
                accepted: asAccepted(q),
                codeAnswer: q.codeAnswer,
              }))}
            />
          </section>
          <aside className="space-y-4">
            <section className="card text-sm" data-testid="settings-summary">
              <h3 className="card-title">{t("qz.f.settings")}</h3>
              <dl className="divide-y divide-border">
                {row(t("qz.f.published"), quiz.isPublished ? "✓" : "—")}
                {row(t("qz.f.opensAt"), quiz.opensAt ? date(quiz.opensAt) : "—")}
                {row(t("qz.f.closesAt"), quiz.closesAt ? date(quiz.closesAt) : "—")}
                {row(t("qz.f.timeLimit"), quiz.timeLimitMin ?? "—")}
                {row(t("qz.f.mode"), t(quiz.requireSeb ? "qz.mode.seb" : "qz.mode.browser"))}
                {row(t("qz.f.where"), quiz.networks.length ? quiz.networks.map((n) => n.name).join(", ") : t("qz.where.anywhere"))}
                {row(t("qz.f.results"), t(`qz.res.${quiz.results}`))}
              </dl>
            </section>
            <ConfirmButton action={deleteQuizAction} name="quizId" value={quiz.id} message={t("qz.deleteQuizConfirm")} label={t("qz.deleteQuiz")} />
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Cadet ----------
  const attempt = await db.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId: quiz.id, studentId: user.id } },
    include: { answers: true },
  });

  if (attempt?.status === "SUBMITTED") {
    const vis = resultsVisible(quiz);
    const totals = attemptTotals(attempt.answers, attempt.maxScore);
    const layout = attempt.layout as Layout;
    const qById = new Map(quiz.questions.map((q) => [q.id, q]));
    const aById = new Map(attempt.answers.map((a) => [a.questionId, a]));
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <section className="card mb-6 text-center">
          <p className="text-sm text-success" data-testid="quiz-done">{t(auto || attempt.autoSubmitted ? "qz.doneAuto" : "qz.done")}</p>
          {vis.score ? (
            totals.score != null ? (
              <p className="mt-3 font-mono text-3xl font-semibold" data-testid="quiz-score">
                {formatPoints(totals.score)} <span className="text-lg text-subtle">/ {formatPoints(attempt.maxScore)}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">{t("qz.pendingGrading")}</p>
            )
          ) : (
            <p className="mt-3 text-sm text-muted">{t(quiz.results === "HIDDEN" ? "qz.resultsHidden" : "qz.resultsLater")}</p>
          )}
        </section>
        {vis.answers && (
          <ol className="space-y-4">
            {layout.questions.map((qid, i) => {
              const q = qById.get(qid);
              if (!q) return null;
              const a = aById.get(qid);
              return (
                <li key={qid} className="card">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
                    <span className="font-mono text-xs">{a?.points != null ? formatPoints(a.points) : "—"} / {formatPoints(q.points)}</span>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap text-sm">{q.prompt}</p>
                  <AnswerView
                    type={q.type}
                    options={asOptions(q)}
                    accepted={asAccepted(q)}
                    codeAnswer={q.codeAnswer}
                    response={(a?.response as Response) ?? null}
                    showKey
                    labels={{ noAnswer: t("qz.noAnswer"), correctAnswer: t("qz.correctAnswer") }}
                  />
                  {a?.feedback && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{a.feedback}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  const block = await examBlock(quiz, base);
  const canStart = !!attempt || (phase === "open" && quiz.questions.length > 0);
  return (
    <div className="mx-auto max-w-xl">
      {header}
      <section className="card space-y-4">
        <h3 className="text-sm font-semibold">{t("qz.rules")}</h3>
        {quiz.instructions && <p className="whitespace-pre-wrap text-sm">{quiz.instructions}</p>}
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            {quiz.timeLimitMin
              ? t("qz.rule.time", { n: quiz.timeLimitMin })
              : quiz.closesAt
                ? t("qz.rule.untilClose", { date: date(quiz.closesAt) })
                : t("qz.rule.noLimit")}
          </li>
          <li>{t("qz.rule.autosave")}</li>
          <li>{t("qz.rule.integrity")}</li>
          {quiz.requireSeb && <li>{t("qz.rule.seb")}</li>}
        </ul>
        {block ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-danger" data-testid="quiz-blocked">
            {t(block === "seb" ? "qz.blocked.seb" : "qz.blocked.ip")}
          </p>
        ) : canStart ? (
          <StartButton quizId={quiz.id} resume={!!attempt} />
        ) : (
          <p className="text-sm text-muted">
            {phase === "upcoming" && quiz.opensAt ? t("qz.blocked.upcoming", { date: date(quiz.opensAt) }) : t("qz.blocked.closed")}
          </p>
        )}
      </section>
    </div>
  );
}
