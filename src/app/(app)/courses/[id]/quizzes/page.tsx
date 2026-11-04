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
            <QuizForm offeringId={offering.id} categories={categories} networks={networks} />
          </Modal>
        </div>
      )}
      <section>
        {quizzes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("qz.none")}</div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {quizzes.map((q) => {
              const phase = quizPhase(q);
              const mine = canManage ? null : q.attempts?.[0];
              return (
                <li key={q.id}>
                  <Link href={`/courses/${offering.id}/quizzes/${q.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{q.title}</span>
                        <span className={`badge ${PHASE_STYLE[phase]}`}>
                          {phase === "upcoming" && q.opensAt ? t("qz.phase.upcoming", { date: date(q.opensAt) }) : t(`qz.phase.${phase}`)}
                        </span>
                        {q.requireSeb && <span className="badge bg-surface-3 text-muted">{t("qz.secLabel")}</span>}
                        {q._count.networks > 0 && <span className="badge bg-surface-3 text-muted">{t("qz.roomsLabel")}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-subtle">
                        {tn("qz.questions", q._count.questions)}
                        {q.timeLimitMin && <> · {t("qz.minutes", { n: q.timeLimitMin })}</>}
                        {q.closesAt && <> · {t("qz.closes", { date: date(q.closesAt) })}</>}
                      </div>
                    </div>
                    {canManage ? (
                      <span className="text-xs text-muted">{t("qz.started", { n: q._count.attempts, total: students.length })}</span>
                    ) : (
                      <span className={`badge ${mine?.status === "SUBMITTED" ? "bg-emerald-500/10 text-success" : mine ? "bg-amber-500/10 text-warning" : "bg-surface-3 text-muted"}`}>
                        {t(mine?.status === "SUBMITTED" ? "qz.status.submitted" : mine ? "qz.status.inProgress" : "qz.status.notStarted")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
