import Link from "next/link";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { studentCanSeeReport, submissionStatus } from "@/lib/assignments";
import { SimilarityBadge } from "@/components/SimilarityBadge";
import { AssignmentForm } from "./AssignmentForm";
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
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section>
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("asg.none")}</div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {assignments.map((a) => {
              const mine = canManage ? null : a.submissions?.[0];
              return (
                <li key={a.id}>
                  <Link href={`/courses/${offering.id}/assignments/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        {!a.isPublished && <span className="badge bg-surface-3 text-muted">{t("asg.draft")}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-subtle">{a.dueAt ? t("asg.due", { date: date(a.dueAt) }) : t("asg.noDue")}</div>
                    </div>
                    {canManage ? (
                      <span className="text-xs text-muted">{t("asg.submittedCount", { n: a._count.submissions, total: students.length })}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {mine && studentCanSeeReport(a) && <SimilarityBadge score={mine.similarity} />}
                        <StatusBadge status={submissionStatus(a, mine)} />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {canManage && (
        <aside>
          <section className="card">
            <h2 className="card-title">{t("asg.new")}</h2>
            <AssignmentForm offeringId={offering.id} categories={categories} sections={siblings} />
          </section>
        </aside>
      )}
    </div>
  );
}
