import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";

export async function generateMetadata() {
  return { title: (await getI18n()).t("nav.courses") };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const user = await requireUser();
  const { term: termParam } = await searchParams;
  const { t, tn, term: termLabel } = await getI18n();

  const terms = await db.term.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] });
  const term = terms.find((x) => x.id === termParam) ?? terms.find((x) => x.isCurrent) ?? terms[0];

  const where: Prisma.CourseOfferingWhereInput = {
    termId: term?.id ?? "__none__",
    ...(user.role === "ADMIN" ? {} : { enrollments: { some: { userId: user.id } } }),
  };
  const offerings = await db.courseOffering.findMany({
    where,
    include: {
      course: true,
      enrollments: { where: { role: "INSTRUCTOR" }, include: { user: { select: { fullName: true } } } },
      _count: { select: { materials: { where: { isPublished: true } } } },
    },
    orderBy: { course: { code: "asc" } },
  });

  return (
    <div>
      <PageHeader
        eyebrow={term ? termLabel(term) : undefined}
        title={t("dash.title")}
        description={term ? tn("dash.count", offerings.length) : t("dash.noTerms")}
        actions={
          terms.length > 1 && (
            <form className="flex items-center gap-2">
              <select name="term" defaultValue={term?.id} className="input h-9 w-auto py-0" aria-label={t("tc.term")}>
                {terms.map((x) => (
                  <option key={x.id} value={x.id}>{termLabel(x)}{x.isCurrent ? ` ${t("dash.current")}` : ""}</option>
                ))}
              </select>
              <button className="btn-secondary h-9">{t("dash.view")}</button>
            </form>
          )
        }
      />

      {offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
          <p className="text-sm text-muted">{t("dash.empty")}</p>
          {user.role === "ADMIN" && (
            <Link href="/admin/courses" className="btn mt-4">{t("dash.setup")}</Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map((o) => (
            <li key={o.id}>
              <Link
                href={`/courses/${o.id}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition hover:border-accent/40 hover:bg-surface-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-accent">{o.course.code}</span>
                  {o.section !== "1" && <span className="badge bg-surface-3 text-muted">{t("dash.section", { s: o.section })}</span>}
                </div>
                <div className="mt-3 font-medium leading-snug">{o.course.title}</div>
                {o.course.titleTh && <div className="mt-0.5 text-sm text-muted">{o.course.titleTh}</div>}
                <div className="mt-auto flex items-center justify-between pt-6 text-xs text-subtle">
                  <span className="truncate">{o.enrollments.map((e) => e.user.fullName).join(", ") || t("dash.noInstructor")}</span>
                  <span className="shrink-0 pl-2">{tn("dash.materials", o._count.materials)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
