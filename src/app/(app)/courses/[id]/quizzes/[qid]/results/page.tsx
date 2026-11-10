import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { formatPoints } from "@/lib/grades";
import { attemptTotals } from "@/lib/quiz";
import { closeExpiredAttempts } from "@/lib/quiz-server";
import { QuizTabs } from "../../QuizTabs";

export default async function QuizResultsPage({ params }: { params: Promise<{ id: string; qid: string }> }) {
  const { id, qid } = await params;
  const { offering, canManage, students } = await loadCourse(id);
  if (!canManage) notFound();
  const { t, tn, date } = await getI18n();

  const quiz = await db.quiz.findUnique({ where: { id: qid }, include: { questions: { orderBy: { position: "asc" } } } });
  if (!quiz || quiz.offeringId !== offering.id) notFound();
  await closeExpiredAttempts(quiz.id);

  const attempts = await db.quizAttempt.findMany({
    where: { quizId: quiz.id },
    include: { answers: { select: { points: true, questionId: true } }, _count: { select: { events: { where: { type: { notIn: ["start", "open", "submit", "autosubmit"] } } } } } },
  });
  const byStudent = new Map(attempts.map((a) => [a.studentId, a]));
  const pendingByQuestion = new Map<string, number>();
  for (const a of attempts)
    if (a.status === "SUBMITTED")
      for (const ans of a.answers) if (ans.points == null) pendingByQuestion.set(ans.questionId, (pendingByQuestion.get(ans.questionId) ?? 0) + 1);
  const base = `/courses/${offering.id}/quizzes/${quiz.id}`;
  const submitted = attempts.filter((a) => a.status === "SUBMITTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 mt-2 text-xl font-semibold tracking-tight">{quiz.title}</h2>
        <QuizTabs
          base={base}
          active="results"
          questions={quiz.questions.length}
          started={attempts.length}
          total={students.length}
          toGrade={[...pendingByQuestion.values()].reduce((n, x) => n + x, 0)}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="results-summary">
          {[
            [t("qz.status.submitted"), `${submitted}/${students.length}`],
            [t("qz.status.inProgress"), String(attempts.length - submitted)],
            [t("qz.status.notStarted"), String(students.length - attempts.length)],
            [t("qz.col.toGrade"), String([...pendingByQuestion.values()].reduce((n, x) => n + x, 0))],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-xs text-muted">{label}</div>
              <div className="mt-0.5 font-mono text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">{t("qz.gradeByQuestion")}</h3>
        <ul className="divide-y divide-border">
          {quiz.questions.map((q, i) => {
            const pending = pendingByQuestion.get(q.id) ?? 0;
            return (
              <li key={q.id}>
                <Link href={`${base}/grade/${q.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface-2 sm:px-5">
                  <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
                  <span className="min-w-0 flex-1 truncate">{q.prompt}</span>
                  <span className="badge hidden bg-surface-3 text-muted sm:inline-flex">{t(`qz.type.${q.type}`)}</span>
                  {pending > 0 ? (
                    <span className="badge bg-accent/15 text-accent" data-testid="q-pending">{t("qz.toGrade", { n: pending })}</span>
                  ) : (
                    <span className="text-xs text-subtle">{t("qz.allGraded")}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="table" data-testid="quiz-results">
            <thead>
              <tr>
                <th className="pl-5">{t("asg.cadet")}</th>
                <th>{t("users.status")}</th>
                <th>{t("asg.submitted")}</th>
                <th>{t("qz.col.score")}</th>
                <th>{t("qz.col.toGrade")}</th>
                <th>{t("qz.col.events")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map(({ user: s }) => {
                const a = byStudent.get(s.id);
                const totals = a ? attemptTotals(a.answers, a.maxScore) : null;
                return (
                  <tr key={s.id}>
                    <td className="pl-5"><span className="font-mono text-xs text-subtle">{s.username}</span> {s.fullName}</td>
                    <td>
                      <span className={`badge ${a?.status === "SUBMITTED" ? "bg-emerald-500/10 text-success" : a ? "bg-amber-500/10 text-warning" : "bg-surface-3 text-muted"}`}>
                        {t(a?.status === "SUBMITTED" ? "qz.status.submitted" : a ? "qz.status.inProgress" : "qz.status.notStarted")}
                      </span>
                      {a?.autoSubmitted && <span className="ml-1 text-xs text-subtle">({t("qz.auto")})</span>}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">{a?.submittedAt ? date(a.submittedAt) : "—"}</td>
                    <td className="font-mono text-xs" data-testid="attempt-score">
                      {a?.status === "SUBMITTED" && totals ? (
                        <>{formatPoints(totals.score ?? totals.partial)}{totals.score == null && "*"} / {formatPoints(a.maxScore)}</>
                      ) : "—"}
                    </td>
                    <td className="text-xs">{a?.status === "SUBMITTED" && totals?.pending ? <span className="text-accent">{totals.pending}</span> : "—"}</td>
                    <td className="text-xs">
                      {a && a._count.events > 0 ? <span className="text-warning" data-testid="attempt-events">{tn("qz.events", a._count.events)}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="pr-5 text-right">
                      {a && <Link href={`${base}/attempts/${a.id}`} className="btn-secondary">{t("qz.review")} <span aria-hidden>›</span></Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
