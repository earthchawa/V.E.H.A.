import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { formatPoints } from "@/lib/grades";
import { attemptTotals, integritySummary, presence, splitDuration } from "@/lib/quiz";
import { closeExpiredAttempts } from "@/lib/quiz-server";
import { InfoTip } from "@/components/InfoTip";
import { LiveRefresh } from "@/components/LiveRefresh";
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
    include: { answers: { select: { points: true, questionId: true } }, events: { where: { type: { notIn: ["start", "open", "submit", "autosubmit"] } }, select: { type: true, details: true } } },
  });
  const byStudent = new Map(attempts.map((a) => [a.studentId, a]));
  const pendingByQuestion = new Map<string, number>();
  for (const a of attempts)
    if (a.status === "SUBMITTED")
      for (const ans of a.answers) if (ans.points == null) pendingByQuestion.set(ans.questionId, (pendingByQuestion.get(ans.questionId) ?? 0) + 1);
  const base = `/courses/${offering.id}/quizzes/${quiz.id}`;
  const submitted = attempts.filter((a) => a.status === "SUBMITTED").length;
  const live = attempts.some((a) => a.status === "IN_PROGRESS");
  const now = new Date();
  const dur = (ms: number) => {
    const { m, s } = splitDuration(ms);
    return m ? t("qz.dur.ms", { m, s }) : t("qz.dur.s", { s });
  };

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
        {live && (
          <div className="border-b border-border px-5 py-2.5">
            <LiveRefresh />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table" data-testid="quiz-results">
            <thead>
              <tr>
                <th className="pl-5">{t("asg.cadet")}</th>
                <th>{t("users.status")}</th>
                <th>{t("asg.submitted")}</th>
                <th>{t("qz.col.score")}</th>
                <th>{t("qz.col.toGrade")}</th>
                <th><span className="inline-flex items-center gap-1.5">{t("qz.col.events")} <InfoTip text={t("qz.integrityHelp")} align="end" /></span></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map(({ user: s }) => {
                const a = byStudent.get(s.id);
                const totals = a ? attemptTotals(a.answers, a.maxScore) : null;
                const integrity = a ? integritySummary(a.events) : null;
                const where = presence(a, now);
                return (
                  <tr key={s.id} className={integrity?.level === "red" ? "bg-red-500/5" : undefined} data-level={integrity?.level ?? undefined}>
                    <td className="pl-5"><span className="font-mono text-xs text-subtle">{s.username}</span> {s.fullName}</td>
                    <td>
                      <span className={`badge ${a?.status === "SUBMITTED" ? "bg-emerald-500/10 text-success" : a ? "bg-amber-500/10 text-warning" : "bg-surface-3 text-muted"}`}>
                        {t(a?.status === "SUBMITTED" ? "qz.status.submitted" : a ? "qz.status.inProgress" : "qz.status.notStarted")}
                      </span>
                      {a?.autoSubmitted && <span className="ml-1 text-xs text-subtle">({t("qz.auto")})</span>}
                      {a && (where === "active" || where === "away" || where === "offline") && (
                        <span
                          className={`mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs ${where === "away" ? "font-medium text-danger" : where === "active" ? "text-success" : "text-muted"}`}
                          data-testid="presence"
                          data-presence={where}
                        >
                          <span className={`h-2 w-2 rounded-full ${where === "away" ? "bg-red-500" : where === "active" ? "bg-emerald-500" : "bg-surface-3 ring-1 ring-border-strong"}`} aria-hidden />
                          {where === "away" && a.awayAt
                            ? t("qz.presence.away", { d: dur(now.getTime() - a.awayAt.getTime()) })
                            : t(where === "active" ? "qz.presence.active" : "qz.presence.offline")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">{a?.submittedAt ? date(a.submittedAt) : "—"}</td>
                    <td className="font-mono text-xs" data-testid="attempt-score">
                      {a?.status === "SUBMITTED" && totals ? (
                        <>{formatPoints(totals.score ?? totals.partial)}{totals.score == null && "*"} / {formatPoints(a.maxScore)}</>
                      ) : "—"}
                    </td>
                    <td className="text-xs">{a?.status === "SUBMITTED" && totals?.pending ? <span className="text-accent">{totals.pending}</span> : "—"}</td>
                    <td className="text-xs">
                      {integrity && integrity.total > 0 ? (
                        <span className={`whitespace-nowrap ${integrity.level === "red" ? "font-medium text-danger" : "text-warning"}`} data-testid="attempt-events">
                          {integrity.level === "red" && <span aria-hidden>⚠ </span>}
                          {tn("qz.events", integrity.total)}
                          {integrity.red > 0 && <> · {t("qz.serious", { n: integrity.red })}</>}
                          {integrity.awayMs > 0 && <span className="block font-normal text-muted">{t("qz.awayTotal", { d: dur(integrity.awayMs) })}</span>}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
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
