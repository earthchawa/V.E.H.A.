import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import type { Response } from "@/lib/quiz";
import { asAccepted, asOptions, closeExpiredAttempts } from "@/lib/quiz-server";
import { AnswerView } from "@/components/AnswerView";
import { GradeAnswers } from "../../../GradeAnswers";

/** Grade one question for the whole class — like marking question 3 on every paper. */
export default async function GradeQuestionPage({ params }: { params: Promise<{ id: string; qid: string; questionId: string }> }) {
  const { id, qid, questionId } = await params;
  const { offering, canManage, canGrade } = await loadCourse(id);
  if (!canManage) notFound();
  const { t } = await getI18n();
  await closeExpiredAttempts(qid);

  const quiz = await db.quiz.findUnique({ where: { id: qid }, include: { questions: { orderBy: { position: "asc" } } } });
  if (!quiz || quiz.offeringId !== offering.id) notFound();
  const idx = quiz.questions.findIndex((q) => q.id === questionId);
  if (idx < 0) notFound();
  const q = quiz.questions[idx];
  const answers = await db.quizAnswer.findMany({
    where: { questionId, attempt: { status: "SUBMITTED" } },
    include: { attempt: { select: { student: { select: { username: true, fullName: true } } } } },
    orderBy: { attempt: { student: { username: "asc" } } },
  });
  const base = `/courses/${offering.id}/quizzes/${qid}`;
  const prev = quiz.questions[idx - 1];
  const next = quiz.questions[idx + 1];
  const labels = { noAnswer: t("qz.noAnswer"), correctAnswer: t("qz.correctAnswer") };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`${base}/results`} className="text-xs text-muted transition hover:text-fg">← {t("qz.results")}</Link>
        <div className="ml-auto flex gap-3 text-xs">
          {prev && <Link href={`${base}/grade/${prev.id}`} className="text-muted hover:text-fg">{t("qz.prevQuestion")}</Link>}
          {next && <Link href={`${base}/grade/${next.id}`} className="text-muted hover:text-fg">{t("qz.nextQuestion")}</Link>}
        </div>
      </div>
      <section className="card mt-3 mb-6">
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">{t("qz.answersFor", { n: idx + 1 })}</h2>
          <span className="badge bg-surface-3 text-muted">{t(`qz.type.${q.type}`)}</span>
          <span className="text-xs text-subtle">{t("qz.pts", { n: q.points })}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{q.prompt}</p>
        {(q.type === "SINGLE" || q.type === "MULTIPLE") && (
          <ul className="mt-2 text-sm">
            {asOptions(q).map((o) => <li key={o.id} className={o.correct ? "text-success" : "text-muted"}>{o.correct ? "✓" : "○"} {o.text}</li>)}
          </ul>
        )}
        {q.type === "SHORT" && asAccepted(q).length > 0 && (
          <p className="mt-2 text-xs text-muted">{t("qz.correctAnswer")}: <span className="text-success">{asAccepted(q).join(" · ")}</span></p>
        )}
      </section>
      {answers.length === 0 ? (
        <p className="text-sm text-muted">{t("asg.noSubmissions")}</p>
      ) : (
        <GradeAnswers
          quizId={qid}
          readOnly={!canGrade}
          rows={answers.map((a) => ({
            answerId: a.id,
            heading: (
              <span className="text-sm">
                <span className="font-mono text-xs text-subtle">{a.attempt.student.username}</span> {a.attempt.student.fullName}
              </span>
            ),
            body: <AnswerView type={q.type} options={asOptions(q)} accepted={asAccepted(q)} codeAnswer={q.codeAnswer} language={q.language} response={a.response as Response} showKey={false} labels={labels} />,
            maxPoints: q.points,
            points: a.points,
            feedback: a.feedback,
            autoGraded: a.autoGraded,
          }))}
        />
      )}
    </div>
  );
}
