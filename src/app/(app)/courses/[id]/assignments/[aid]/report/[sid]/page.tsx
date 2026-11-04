import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { studentCanSeeReport } from "@/lib/assignments";
import { K, type Segment, type Span } from "@/lib/similarity/engine";
import { level } from "@/lib/similarity/level";
import { buildPieces } from "@/lib/similarity/highlight";
import { ReportView, type ReportSource } from "@/components/ReportView";
import { GradePanel } from "./GradePanel";

const RING = { low: "text-success", medium: "text-warning", high: "text-danger" } as const;

export async function generateMetadata() {
  return { title: (await getI18n()).t("rep.title") };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string; aid: string; sid: string }> }) {
  const { id, aid, sid } = await params;
  const { user, offering, canManage, canGrade } = await loadCourse(id);
  const { t, date, pct } = await getI18n();

  const assignment = await db.assignment.findUnique({ where: { id: aid }, include: { gradeItem: true } });
  const submission = await db.submission.findUnique({
    where: { id: sid },
    include: { student: { select: { username: true, fullName: true } } },
  });
  if (!assignment || assignment.offeringId !== offering.id || !submission || submission.assignmentId !== aid) notFound();
  // Cadets only ever see their own report, and only when the instructor allows it.
  if (!canManage && !(submission.studentId === user.id && assignment.isPublished && studentCanSeeReport(assignment))) notFound();

  const matches = await db.similarityMatch.findMany({
    where: { OR: [{ aId: sid }, { bId: sid }] },
    include: {
      a: { select: { id: true, student: { select: { fullName: true, username: true } } } },
      b: { select: { id: true, student: { select: { fullName: true, username: true } } } },
    },
  });
  const sides = matches
    .map((m) => {
      const mine = m.aId === sid;
      const other = mine ? m.b : m.a;
      return { share: mine ? m.scoreA : m.scoreB, spans: (mine ? m.spansA : m.spansB) as Span[], other };
    })
    .filter((s) => s.share > 0)
    .sort((x, y) => y.share - x.share);

  const base = `/courses/${offering.id}/assignments/${aid}`;
  const sources: ReportSource[] = sides.map((s, i) => ({
    label: canManage ? `${s.other.student.fullName} (${s.other.student.username})` : t("rep.peer", { n: i + 1 }),
    share: s.share,
    compareHref: canManage ? `${base}/compare?a=${sid}&b=${s.other.id}` : undefined,
  }));
  const pieces = submission.content
    ? buildPieces(submission.content, submission.segments as Segment[], sides.map((s) => s.spans))
    : [];
  const grade =
    canGrade && assignment.gradeItem
      ? await db.grade.findUnique({ where: { itemId_studentId: { itemId: assignment.gradeItem.id, studentId: submission.studentId } } })
      : null;
  const score = submission.similarity ?? 0;
  const lv = level(score);

  return (
    <div>
      <Link href={base} className="text-xs text-muted transition hover:text-fg">← {assignment.title}</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("rep.title")}</h2>
          <p className="mt-1 text-sm text-muted">
            {submission.student.fullName} <span className="font-mono text-xs text-subtle">{submission.student.username}</span>
            {submission.checkedAt && <> · {t("rep.checkedAt", { date: date(submission.checkedAt) })}</>}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3">
          <div className={`font-mono text-3xl font-semibold ${RING[lv]}`} data-testid="overall">{submission.similarity == null ? "—" : pct(score)}</div>
          <div className="text-xs">
            <div className="font-medium">{t("rep.overall")} · <span className={RING[lv]}>{t(`rep.level.${lv}`)}</span></div>
            <div className="mt-0.5 max-w-52 text-subtle">{t("rep.overallHint")}</div>
          </div>
        </div>
      </div>
      {canGrade && assignment.gradeItem && (
        <GradePanel
          itemId={assignment.gradeItem.id}
          studentId={submission.studentId}
          maxPoints={assignment.gradeItem.maxPoints}
          points={grade?.points ?? null}
          feedback={grade?.feedback ?? null}
          released={assignment.gradeItem.isReleased}
        />
      )}
      <ReportView pieces={pieces} sources={sources} />
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-subtle">{t("rep.method", { k: K.text, kc: K.code })}</p>
    </div>
  );
}
