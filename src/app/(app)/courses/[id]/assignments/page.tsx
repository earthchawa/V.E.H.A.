import Link from "next/link";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { studentCanSeeReport, submissionStatus } from "@/lib/assignments";
import { SimilarityBadge } from "@/components/SimilarityBadge";
import { AssignmentForm } from "./AssignmentForm";
import { Modal } from "@/components/Modal";
import { siblingSections } from "@/lib/sections";
import { StatusBadge } from "./StatusBadge";

export default async function AssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const { t, date } = await getI18n();

  const siblings = canManage ? await siblingSections(user, offering.id) : [];
  const categories = canManage
    ? await db.gradeCategory.findMany({ where: { offeringId: offering.id }, orderBy: { position: "asc" }, select: { id: true, name: true } })
    : [];
  const assignments = await db.assignment.findMany({
    where: { offeringId: offering.id, ...(canManage ? {} : { isPublished: true }) },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      _count: { select: { submissions: true } },
      submissions: canManage ? false : { where: { studentId: user.id } },
    },
  });

  return (
    <div>
      {canManage && (
        <div className="mb-6">
          <Modal label={`+ ${t("asg.new")}`} title={t("asg.new")} size="lg" testId="new-assignment">
            <AssignmentForm offeringId={offering.id} categories={categories} sections={siblings} />
          </Modal>
        </div>
      )}
      <section>
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("asg.none")}</div>
        ) : (
          <ul className="space-y-3" data-testid="assignment-list">
            {assignments.map((a) => {
              const mine = canManage ? null : a.submissions?.[0];
              const href = `/courses/${offering.id}/assignments/${a.id}`;
              const status = canManage ? null : submissionStatus(a, mine);
              return (
                <li key={a.id} className="row-link relative rounded-xl border border-border bg-surface" data-testid="assignment-row">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-accent/10 text-lg text-accent" aria-hidden>▣</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={href} className="text-base font-semibold after:absolute after:inset-0 after:rounded-xl">{a.title}</Link>
                        {!a.isPublished && <span className="badge bg-surface-3 text-muted">{t("asg.draft")}</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted">{a.dueAt ? t("asg.due", { date: date(a.dueAt) }) : t("asg.noDue")}</div>
                    </div>
                    {canManage ? (
                      <div className="flex w-full items-center gap-4 sm:w-auto">
                        <div className="min-w-0 flex-1 sm:w-28 sm:flex-none" title={t("asg.submittedCount", { n: a._count.submissions, total: students.length })}>
                          <div className="mb-1 text-right text-xs text-muted">{t("asg.submittedCount", { n: a._count.submissions, total: students.length })}</div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${students.length ? Math.round((a._count.submissions / students.length) * 100) : 0}%` }} />
                          </div>
                        </div>
                        <span className="btn h-9 px-3.5" aria-hidden>
                          {t("asg.submissions")} <span className="row-chevron">›</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {mine && studentCanSeeReport(a) && <SimilarityBadge score={mine.similarity} />}
                        <StatusBadge status={status!} />
                        <span className={`${mine ? "btn-secondary" : "btn"} h-9 px-3.5 text-sm`} aria-hidden>
                          {t(mine ? "row.open" : "asg.submit")} <span className="row-chevron">›</span>
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
