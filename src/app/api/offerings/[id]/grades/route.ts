import { getCurrentUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { computeStudent, gradePoints, normaliseScale } from "@/lib/grades";

/** Gradebook export for instructors/admins (UTF-8 with BOM so Excel shows Thai names). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if ((await offeringAccess(user, id)) !== "manage") return new Response("Not found", { status: 404 });

  const offering = await db.courseOffering.findUniqueOrThrow({
    where: { id },
    include: {
      course: true,
      term: true,
      gradeCategories: { orderBy: { position: "asc" } },
      gradeItems: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { grades: true } },
      enrollments: { where: { role: "STUDENT" }, include: { user: true }, orderBy: { user: { username: "asc" } } },
    },
  });
  const scale = normaliseScale(offering.gradeScale);
  const cats = offering.gradeCategories.map((c) => ({ id: c.id, name: c.name, weight: c.weight }));
  const items = offering.gradeItems;

  const header = [
    "username",
    "fullName",
    ...items.map((i) => `${i.title} (/${i.maxPoints})`),
    ...cats.map((c) => `${c.name} % (${c.weight}%)`),
    "total %",
    "grade",
    "grade points",
  ];
  const rows = offering.enrollments.map(({ user: s }) => {
    const pts = new Map(items.map((i) => [i.id, i.grades.find((g) => g.studentId === s.id)?.points ?? null]));
    const r = computeStudent(cats, items, pts, { scale });
    const round = (n: number | null | undefined) => (n == null ? "" : Math.round(n * 100) / 100);
    return [
      s.username,
      s.fullName,
      ...items.map((i) => round(pts.get(i.id))),
      ...r.categories.map((c) => round(c.pct)),
      round(r.totalPct),
      r.letter ?? "",
      gradePoints(r.letter) ?? "",
    ];
  });

  const name = `grades-${offering.course.code}-${offering.term.academicYear}-${offering.term.semester}-sec${offering.section}.csv`;
  return new Response("﻿" + toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
