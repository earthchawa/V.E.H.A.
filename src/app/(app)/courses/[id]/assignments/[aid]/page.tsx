import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { acceptsSubmissions, studentCanSeeReport, submissionStatus, toBangkokLocal, uploadLimits } from "@/lib/assignments";
import { config } from "@/lib/config";
import { SimilarityBadge } from "@/components/SimilarityBadge";
import { AssignmentForm } from "../AssignmentForm";
import { SubmitForm } from "../SubmitForm";
import { StatusBadge } from "../StatusBadge";
import { DeleteAssignmentButton, RecheckButton } from "../ManageButtons";

export default async function AssignmentPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const { t, date, pct } = await getI18n();

  const assignment = await db.assignment.findUnique({ where: { id: aid } });
  if (!assignment || assignment.offeringId !== offering.id || (!canManage && !assignment.isPublished)) notFound();
  const base = `/courses/${offering.id}/assignments/${assignment.id}`;

  const header = (
    <div className="mb-6">
      <Link href={`/courses/${offering.id}/assignments`} className="text-xs text-muted transition hover:text-fg">{t("asg.back")}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{assignment.title}</h2>
        {!assignment.isPublished && <span className="badge bg-surface-3 text-muted">{t("asg.draft")}</span>}
      </div>
      <p className="mt-1 text-sm text-muted">{assignment.dueAt ? t("asg.due", { date: date(assignment.dueAt) }) : t("asg.noDue")}</p>
    </div>
  );
  const instructions = assignment.instructions && (
    <section className="card">
      <h3 className="card-title">{t("asg.instructions")}</h3>
      <div className="whitespace-pre-wrap text-sm leading-7 text-fg/90">{assignment.instructions}</div>
    </section>
  );

  // ---------- Instructor view ----------
  if (canManage) {
    const [submissions, matches] = await Promise.all([
      db.submission.findMany({
        where: { assignmentId: assignment.id },
        include: { student: { select: { id: true, username: true, fullName: true } } },
      }),
      db.similarityMatch.findMany({ where: { assignmentId: assignment.id } }),
    ]);
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const nameOf = new Map(submissions.map((s) => [s.id, s.student.fullName]));
    const rows = students
      .map((e) => ({ student: e.user, sub: byStudent.get(e.user.id) }))
      .sort((a, b) => (b.sub?.similarity ?? -1) - (a.sub?.similarity ?? -1));
    const pairs = matches
      .map((m) => ({ ...m, top: Math.max(m.scoreA, m.scoreB) }))
      .sort((a, b) => b.top - a.top)
      .slice(0, 8);

    return (
      <div>
        {header}
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-6">
            {instructions}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">
                  {t("asg.submissions")} <span className="font-normal text-subtle">{t("asg.submittedCount", { n: submissions.length, total: students.length })}</span>
                </h3>
                <div className="ml-auto">
                  {assignment.checkSimilarity ? <RecheckButton assignmentId={assignment.id} /> : <span className="text-xs text-subtle">{t("asg.checkOff")}</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th className="pl-5">{t("asg.cadet")}</th><th>{t("users.status")}</th><th>{t("asg.submitted")}</th><th>{t("asg.similarity")}</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map(({ student, sub }) => (
                      <tr key={student.id}>
                        <td className="pl-5"><span className="font-mono text-xs text-subtle">{student.username}</span> {student.fullName}</td>
                        <td><StatusBadge status={submissionStatus(assignment, sub)} /></td>
                        <td className="whitespace-nowrap text-xs text-muted">
                          {sub ? <>{date(sub.submittedAt)} <span className="text-subtle">· {t("asg.version", { n: sub.version })}</span></> : "—"}
                        </td>
                        <td>{sub && assignment.checkSimilarity ? <SimilarityBadge score={sub.similarity} /> : <span className="text-subtle">—</span>}</td>
                        <td className="pr-5 text-right">
                          {sub && <Link href={`${base}/report/${sub.id}`} className="btn-secondary">{t("asg.report")}</Link>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {assignment.checkSimilarity && (
              <section className="card">
                <h3 className="card-title">{t("asg.topPairs")}</h3>
                {pairs.length === 0 ? (
                  <p className="text-sm text-muted">{t("rep.noMatches")}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {pairs.map((p) => (
                      <li key={p.id}>
                        <Link href={`${base}/compare?a=${p.aId}&b=${p.bId}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface-2" data-testid="pair">
                          <span className="min-w-0 flex-1 truncate">{nameOf.get(p.aId)} ↔ {nameOf.get(p.bId)}</span>
                          <span className="font-mono text-xs text-muted">{pct(p.top)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <details className="card group">
              <summary className="cursor-pointer list-none text-sm font-semibold">
                {t("asg.edit")} <span className="text-subtle transition group-open:rotate-90">›</span>
              </summary>
              <div className="mt-4">
                <AssignmentForm
                  offeringId={offering.id}
                  assignmentId={assignment.id}
                  defaults={{
                    title: assignment.title,
                    instructions: assignment.instructions ?? "",
                    dueAt: toBangkokLocal(assignment.dueAt),
                    allowLate: assignment.allowLate,
                    isPublished: assignment.isPublished,
                    checkSimilarity: assignment.checkSimilarity,
                    ignoreCommon: assignment.ignoreCommon,
                    reportVisibility: assignment.reportVisibility,
                    baseText: assignment.baseText ?? "",
                  }}
                />
                <div className="mt-6 border-t border-border pt-4"><DeleteAssignmentButton assignmentId={assignment.id} /></div>
              </div>
            </details>
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Cadet view ----------
  const mine = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: user.id } },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  const open = acceptsSubmissions(assignment);
  const canSeeReport = studentCanSeeReport(assignment);

  return (
    <div>
      {header}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {instructions}
          <section className="card">
            <h3 className="card-title">{t("asg.yourSubmission")}</h3>
            {open ? (
              <SubmitForm assignmentId={assignment.id} defaultText={mine?.textAnswer ?? ""} hasFiles={!!mine?.files.length} resubmit={!!mine} limits={uploadLimits(config.maxUploadMb)} />
            ) : (
              <p className="text-sm text-muted">{t("asg.closed")}</p>
            )}
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t("users.status")}</span>
              <StatusBadge status={submissionStatus(assignment, mine)} />
            </div>
            {mine && (
              <>
                <p className="text-xs text-subtle">{t("asg.submittedAt", { date: date(mine.submittedAt) })} · {t("asg.version", { n: mine.version })}</p>
                {mine.files.length > 0 && (
                  <ul className="space-y-1.5 text-sm">
                    {mine.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <a href={`/api/submission-files/${f.id}`} className="min-w-0 flex-1 truncate transition hover:text-accent">{f.fileName}</a>
                        <span className="shrink-0 text-xs text-subtle">{f.extracted ? formatBytes(f.sizeBytes) : t("asg.notAnalyzed")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {assignment.checkSimilarity && (
                  canSeeReport ? (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <SimilarityBadge score={mine.similarity} showLevel />
                      <Link href={`${base}/report/${mine.id}`} className="btn-secondary">{t("asg.viewReport")}</Link>
                    </div>
                  ) : assignment.reportVisibility === "AFTER_DUE" ? (
                    <p className="border-t border-border pt-4 text-xs text-muted">{t("asg.reportAfterDue")}</p>
                  ) : null
                )}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
