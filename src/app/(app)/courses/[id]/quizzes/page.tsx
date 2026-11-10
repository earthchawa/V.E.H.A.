import { config } from "@/lib/config";
import { sebRequired } from "@/lib/quiz-server";
import Link from "next/link";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { quizPhase } from "@/lib/quiz";
import { QuizForm } from "./QuizForm";
import { Modal } from "@/components/Modal";

const PHASE_STYLE = {
  draft: "bg-surface-3 text-muted",
  upcoming: "bg-accent/15 text-accent",
  open: "bg-emerald-500/10 text-success",
  closed: "bg-surface-3 text-muted",
} as const;

export default async function QuizzesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const { t, tn, date } = await getI18n();

  const quizzes = await db.quiz.findMany({
    where: { offeringId: offering.id, ...(canManage ? {} : { isPublished: true }) },
    orderBy: [{ opensAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      _count: { select: { questions: true, attempts: true, networks: true } },
      attempts: canManage ? false : { where: { studentId: user.id } },
    },
  });
  const [categories, networks] = canManage
    ? await Promise.all([
        db.gradeCategory.findMany({ where: { offeringId: offering.id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
        db.examNetwork.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : [[], []];

  return (
    <div>
      {canManage && (
        <div className="mb-6">
          <Modal label={`+ ${t("qz.new")}`} title={t("qz.new")} size="lg" testId="new-quiz">
            <QuizForm offeringId={offering.id} categories={categories} networks={networks} sebEnabled={config.sebEnabled} />
          </Modal>
        </div>
      )}
      <section>
        {quizzes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("qz.none")}</div>
        ) : (
          <ul className="space-y-3" data-testid="quiz-list">
            {quizzes.map((q) => {
              const phase = quizPhase(q);
              const mine = canManage ? null : q.attempts?.[0];
              const href = `/courses/${offering.id}/quizzes/${q.id}`;
              return (
                <li key={q.id} className="row-link relative rounded-xl border border-border bg-surface" data-testid="quiz-row">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-accent/10 text-lg text-accent" aria-hidden>✎</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* The title link covers the whole card; the buttons on the right sit above it. */}
                        <Link href={href} className="text-base font-semibold after:absolute after:inset-0 after:rounded-xl">{q.title}</Link>
                        <span className={`badge ${PHASE_STYLE[phase]}`}>
                          {phase === "upcoming" && q.opensAt ? t("qz.phase.upcoming", { date: date(q.opensAt) }) : t(`qz.phase.${phase}`)}
                        </span>
                        {sebRequired(q) && <span className="badge bg-surface-3 text-muted">{t("qz.secLabel")}</span>}
                        {q._count.networks > 0 && <span className="badge bg-surface-3 text-muted">{t("qz.roomsLabel")}</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {tn("qz.questions", q._count.questions)}
                        {q.timeLimitMin && <> · {t("qz.minutes", { n: q.timeLimitMin })}</>}
                        {q.closesAt && <> · {t("qz.closes", { date: date(q.closesAt) })}</>}
                      </div>
                    </div>
                    {canManage ? (
                      <div className="relative z-[1] flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <Link href={href} className="btn-secondary h-9 flex-1 px-3.5 text-sm sm:flex-none" data-testid="row-questions">
                          <span aria-hidden>✎</span> {t("qz.builder")}
                        </Link>
                        <Link href={`${href}/results`} className="btn h-9 flex-1 px-3.5 sm:flex-none" data-testid="row-results">
                          <span aria-hidden>▤</span> {t("qz.results")}
                          <span className="rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[11px]">{q._count.attempts}/{students.length}</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className={`badge ${mine?.status === "SUBMITTED" ? "bg-emerald-500/10 text-success" : mine ? "bg-amber-500/10 text-warning" : "bg-surface-3 text-muted"}`}>
                          {t(mine?.status === "SUBMITTED" ? "qz.status.submitted" : mine ? "qz.status.inProgress" : "qz.status.notStarted")}
                        </span>
                        <span className="btn-secondary h-9 px-3.5 text-sm" aria-hidden>
                          {t(mine?.status === "SUBMITTED" ? "row.viewResult" : mine ? "qz.resume" : "row.open")} <span className="row-chevron">›</span>
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
