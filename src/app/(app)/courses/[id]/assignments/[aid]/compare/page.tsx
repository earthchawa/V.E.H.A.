import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import type { Segment, Span } from "@/lib/similarity/engine";
import { buildPieces } from "@/lib/similarity/highlight";
import { HighlightedContent } from "@/components/HighlightedContent";

export async function generateMetadata() {
  return { title: (await getI18n()).t("cmp.title") };
}

/** Instructor-only side-by-side view of two submissions with their shared passages highlighted. */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aid: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id, aid } = await params;
  const { a = "", b = "" } = await searchParams;
  const { offering, canManage } = await loadCourse(id);
  if (!canManage) notFound();
  const { t, pct } = await getI18n();

  const assignment = await db.assignment.findUnique({ where: { id: aid } });
  const subs = await db.submission.findMany({
    where: { id: { in: [a, b] }, assignmentId: aid },
    include: { student: { select: { username: true, fullName: true } } },
  });
  if (!assignment || assignment.offeringId !== offering.id || subs.length !== 2) notFound();
  const match = await db.similarityMatch.findFirst({ where: { OR: [{ aId: a, bId: b }, { aId: b, bId: a }] } });

  const side = (sid: string) => {
    const s = subs.find((x) => x.id === sid)!;
    const isA = match?.aId === sid;
    const spans = (match ? (isA ? match.spansA : match.spansB) : []) as Span[];
    const share = match ? (isA ? match.scoreA : match.scoreB) : 0;
    return { s, share, pieces: buildPieces(s.content, s.segments as Segment[], [spans]) };
  };
  const left = side(a);
  const right = side(b);
  const base = `/courses/${offering.id}/assignments/${aid}`;

  return (
    <div>
      <Link href={base} className="text-xs text-muted transition hover:text-fg">← {assignment.title}</Link>
      <h2 className="mt-2 mb-6 text-xl font-semibold tracking-tight">{t("cmp.title")}</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        {[left, right].map(({ s, share, pieces }) => (
          <section key={s.id} className="card min-w-0">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{s.student.fullName}</div>
                <div className="font-mono text-xs text-subtle">{s.student.username}</div>
              </div>
              <Link href={`${base}/report/${s.id}`} className="text-right text-xs text-muted hover:text-fg">
                <span className="font-mono text-base text-danger">{pct(share)}</span>
                <br />
                {t("cmp.share", { pct: "" }).trim()}
              </Link>
            </div>
            <HighlightedContent pieces={pieces} labels={[`${left.s.student.fullName} ↔ ${right.s.student.fullName}`]} />
          </section>
        ))}
      </div>
    </div>
  );
}
