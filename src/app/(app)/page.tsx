import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { cadetQuizTodo, cadetTodo, instructorQuizTodo, instructorTodo } from "@/lib/todo";

export async function generateMetadata() {
  return { title: (await getI18n()).t("nav.courses") };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const user = await requireUser();
  const { term: termParam } = await searchParams;
  const { t, tn, term: termLabel, date } = await getI18n();

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

  // Show "Sec N" whenever a course runs more than one section this term.
  const multiSection = new Set(
    term
      ? (await db.courseOffering.groupBy({ by: ["courseId"], where: { termId: term.id }, _count: { _all: true } }))
          .filter((g) => g._count._all > 1)
          .map((g) => g.courseId)
      : [],
  );
  const [teaching, studying] = term
    ? await Promise.all([
        db.enrollment.count({ where: { userId: user.id, role: "INSTRUCTOR", offering: { termId: term.id } } }),
        db.enrollment.count({ where: { userId: user.id, role: "STUDENT", offering: { termId: term.id } } }),
      ])
    : [0, 0];
  const [iTodo, cTodo, iQuiz, cQuiz] = await Promise.all([
    teaching && term ? instructorTodo(user.id, term.id) : Promise.resolve([]),
    studying && term ? cadetTodo(user.id, term.id) : Promise.resolve([]),
    teaching && term ? instructorQuizTodo(user.id, term.id) : Promise.resolve([]),
    studying && term ? cadetQuizTodo(user.id, term.id) : Promise.resolve([]),
  ]);
  const quizRow = (r: (typeof iQuiz)[number], right: React.ReactNode) => (
    <li key={r.quizId}>
      <Link href={`/courses/${r.offeringId}/quizzes/${r.quizId}${r.toGrade ? "/results" : ""}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm transition hover:bg-surface-2">
        <span className="font-mono text-xs text-accent">
          {r.courseCode}{multiSection.has(r.courseId) ? ` · ${t("dash.section", { s: r.section })}` : ""}
        </span>
        <span className="badge bg-surface-3 text-muted">{t("course.tab.quizzes")}</span>
        <span className="min-w-0 flex-1 truncate">{r.title}</span>
        {right}
      </Link>
    </li>
  );

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

      {teaching > 0 && (
        <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface" data-testid="instructor-todo">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{t("todo.title")}</h2>
          {iTodo.length === 0 && iQuiz.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">{t("todo.allClear")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {iQuiz.map((r) => quizRow(r, <span className="badge bg-accent/15 text-accent">{tn("todo.quizToGrade", r.toGrade)}</span>))}
              {iTodo.map((r) => (
                <li key={r.assignmentId}>
                  <Link href={`/courses/${r.offeringId}/assignments/${r.assignmentId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm transition hover:bg-surface-2">
                    <span className="font-mono text-xs text-accent">
                      {r.courseCode}{multiSection.has(r.courseId) ? ` · ${t("dash.section", { s: r.section })}` : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.ungraded > 0 && <span className="badge bg-accent/15 text-accent">{tn("todo.ungraded", r.ungraded)}</span>}
                    {r.highSimilarity > 0 && <span className="badge bg-red-500/10 text-danger">{tn("todo.highSim", r.highSimilarity)}</span>}
                    {r.dueSoon && <span className="text-xs text-subtle">{t("todo.dueSubmitted", { date: date(r.dueSoon), n: r.submitted, total: r.total })}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {studying > 0 && (
        <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface" data-testid="cadet-todo">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{t("todo.dueSoon")}</h2>
          {cTodo.length === 0 && cQuiz.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">{t("todo.noDue")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {cQuiz.map((r) =>
                quizRow(r, <span className="text-xs text-success">{r.closesAt ? t("todo.quizOpen", { date: date(r.closesAt) }) : t("qz.phase.open")}</span>),
              )}
              {cTodo.map((r) => (
                <li key={r.assignmentId}>
                  <Link href={`/courses/${r.offeringId}/assignments/${r.assignmentId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm transition hover:bg-surface-2">
                    <span className="font-mono text-xs text-accent">{r.courseCode}</span>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <span className={`text-xs ${r.overdue ? "text-warning" : "text-subtle"}`}>
                      {r.overdue ? t("todo.overdueOpen") : r.dueAt ? t("asg.due", { date: date(r.dueAt) }) : t("asg.noDue")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                  {multiSection.has(o.courseId) && <span className="badge bg-surface-3 text-muted">{t("dash.section", { s: o.section })}</span>}
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
