import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { courseTheme, deptLogo } from "@/lib/departments";
import { PageHeader } from "@/components/PageHeader";
import { cadetQuizTodo, cadetTodo, instructorQuizTodo, instructorTodo } from "@/lib/todo";

export async function generateMetadata() {
  return { title: (await getI18n()).t("nav.courses") };
}

type TodoItem = {
  key: string;
  href: string;
  courseId: string;
  courseCode: string;
  section: string;
  kind: "assignment" | "quiz";
  title: string;
  badges: { text: string; tone: "accent" | "danger" | "success" }[];
  meta?: { text: string; warn?: boolean };
};

const TONE = {
  accent: "bg-accent/15 text-accent",
  danger: "bg-red-500/10 text-danger",
  success: "bg-emerald-500/10 text-success",
} as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const user = await requireUser();
  const { term: termParam } = await searchParams;
  const { t, tn, term: termLabel, date, lang } = await getI18n();

  const allTerms = await db.term.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] });
  // Instructors and cadets only see semesters they have courses in (plus the current one); admins see all.
  const mine =
    user.role === "ADMIN"
      ? null
      : new Set((await db.courseOffering.findMany({ where: { enrollments: { some: { userId: user.id } } }, select: { termId: true }, distinct: ["termId"] })).map((o) => o.termId));
  const terms = allTerms.filter((x) => !mine || x.isCurrent || mine.has(x.id));
  const current = allTerms.find((x) => x.isCurrent) ?? null;
  const term = terms.find((x) => x.id === termParam) ?? current ?? terms[0];
  const isUpcoming = (x: { academicYear: number; semester: number }) =>
    !!current && (x.academicYear > current.academicYear || (x.academicYear === current.academicYear && x.semester > current.semester));
  // Courses this instructor teaches in a later semester, so they can prepare ahead.
  const upcomingTeaching =
    term?.isCurrent
      ? await db.courseOffering.findMany({
          where: { term: { OR: terms.filter(isUpcoming).map((x) => ({ id: x.id })) }, enrollments: { some: { userId: user.id, role: "INSTRUCTOR" } } },
          include: { term: true, course: { select: { code: true } } },
          orderBy: { course: { code: "asc" } },
        })
      : [];
  const nextTerm = upcomingTeaching[0]?.term ?? null;

  const where: Prisma.CourseOfferingWhereInput = {
    termId: term?.id ?? "__none__",
    ...(user.role === "ADMIN" ? {} : { enrollments: { some: { userId: user.id } } }),
  };
  const offerings = await db.courseOffering.findMany({
    where,
    include: {
      course: { include: { department: { include: { parent: true } } } },
      enrollments: { where: { role: "INSTRUCTOR" }, include: { user: { select: { fullName: true } } } },
      _count: { select: { materials: { where: { isPublished: true } } } },
    },
    orderBy: [{ course: { code: "asc" } }, { section: "asc" }],
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

  // One list of "things for you", whatever their source.
  const items: TodoItem[] = [
    ...iQuiz.map((r): TodoItem => ({
      key: `iq-${r.quizId}`,
      href: `/courses/${r.offeringId}/quizzes/${r.quizId}/results`,
      courseId: r.courseId,
      courseCode: r.courseCode,
      section: r.section,
      kind: "quiz",
      title: r.title,
      badges: [{ text: tn("todo.quizToGrade", r.toGrade), tone: "accent" }],
    })),
    ...iTodo.map((r): TodoItem => ({
      key: `ia-${r.assignmentId}`,
      href: `/courses/${r.offeringId}/assignments/${r.assignmentId}`,
      courseId: r.courseId,
      courseCode: r.courseCode,
      section: r.section,
      kind: "assignment",
      title: r.title,
      badges: [
        ...(r.ungraded ? [{ text: tn("todo.ungraded", r.ungraded), tone: "accent" as const }] : []),
        ...(r.highSimilarity ? [{ text: tn("todo.highSim", r.highSimilarity), tone: "danger" as const }] : []),
      ],
      meta: r.dueSoon ? { text: t("todo.dueSubmitted", { date: date(r.dueSoon), n: r.submitted, total: r.total }) } : undefined,
    })),
    ...cQuiz.map((r): TodoItem => ({
      key: `cq-${r.quizId}`,
      href: `/courses/${r.offeringId}/quizzes/${r.quizId}`,
      courseId: r.courseId,
      courseCode: r.courseCode,
      section: r.section,
      kind: "quiz",
      title: r.title,
      badges: [{ text: t("qz.phase.open"), tone: "success" }],
      meta: r.closesAt ? { text: t("todo.quizOpen", { date: date(r.closesAt) }) } : undefined,
    })),
    ...cTodo.map((r): TodoItem => ({
      key: `ca-${r.assignmentId}`,
      href: `/courses/${r.offeringId}/assignments/${r.assignmentId}`,
      courseId: r.courseId,
      courseCode: r.courseCode,
      section: "",
      kind: "assignment",
      title: r.title,
      badges: [],
      meta: { text: r.overdue ? t("todo.overdueOpen") : r.dueAt ? t("asg.due", { date: date(r.dueAt) }) : t("asg.noDue"), warn: r.overdue },
    })),
  ];
  const showTodo = teaching > 0 || studying > 0;

  // Group course cards by department (division › department), departments first, then the rest.
  const dName = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  type Group = { key: string; title: string | null; subtitle: string | null; logo: string | null; color: string | null; sort: string; offerings: typeof offerings };
  // Theme per course (department colour, else a stable colour from the code) — reused by the to-do rows.
  const themeByCourse = new Map(offerings.map((o) => [o.courseId, courseTheme(o.course.code, o.course.department)]));
  const themeFor = (courseId: string, code: string) => themeByCourse.get(courseId) ?? courseTheme(code);
  const groups = new Map<string, Group>();
  for (const o of offerings) {
    const d = o.course.department;
    const key = d?.id ?? "none";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: d ? dName(d) : null,
        subtitle: d?.parent ? dName(d.parent) : null,
        logo: deptLogo(d),
        color: d?.color ?? d?.parent?.color ?? null,
        sort: d ? `${d.parent?.code ?? d.code}/${d.parent ? d.code : ""}` : "~",
        offerings: [],
      });
    }
    groups.get(key)!.offerings.push(o);
  }
  const ordered = [...groups.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  const grouped = ordered.some((g) => g.title);

  return (
    <div>
      <PageHeader
        eyebrow={term ? termLabel(term) : undefined}
        title={t("dash.title")}
        description={term ? tn("dash.count", offerings.length) : t("dash.noTerms")}
      />
      {terms.length > 1 && (
        <nav className="-mt-4 mb-6 flex flex-wrap gap-2" aria-label={t("tc.term")} data-testid="dash-semesters">
          {[...terms].reverse().map((x) => (
            <Link
              key={x.id}
              href={x.isCurrent ? "/" : `/?term=${x.id}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                term?.id === x.id ? "border-accent/50 bg-accent/15 text-fg" : "border-border text-muted hover:bg-surface-3 hover:text-fg"
              }`}
            >
              {termLabel(x)}
              {x.isCurrent && <span className="text-success">● {t("dash.currentShort")}</span>}
              {isUpcoming(x) && <span className="text-accent">{t("tc.upcoming")}</span>}
            </Link>
          ))}
        </nav>
      )}
      {nextTerm && (
        <Link
          href={`/?term=${nextTerm.id}`}
          className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm transition hover:bg-surface-2"
          data-testid="upcoming-teaching"
        >
          <span className="badge bg-accent/10 text-accent">{t("tc.upcoming")}</span>
          <span className="min-w-0 flex-1">
            {t("dash.upcoming", { term: termLabel(nextTerm), n: upcomingTeaching.filter((o) => o.termId === nextTerm.id).length })}
            <span className="ml-1.5 font-mono text-xs text-subtle">
              {upcomingTeaching.filter((o) => o.termId === nextTerm.id).map((o) => o.course.code).join(" · ")}
            </span>
          </span>
          <span className="text-accent">{t("dash.prepare")} →</span>
        </Link>
      )}

      {showTodo && (
        <section
          className="mb-10 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.10] to-accent/[0.02] p-1.5"
          data-testid={teaching ? "instructor-todo" : "cadet-todo"}
        >
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg" aria-hidden>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 2.5a5 5 0 0 0-5 5v3l-1.5 3h13L15 10.5v-3a5 5 0 0 0-5-5ZM8 16a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold">{teaching ? t("todo.title") : t("todo.dueSoon")}</h2>
            <span className="badge bg-accent/15 text-accent">{tn("todo.count", items.length)}</span>
          </div>
          {items.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-4 text-sm text-muted">{teaching ? t("todo.allClear") : t("todo.noDue")}</p>
          ) : (
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    style={themeFor(it.courseId, it.courseCode).style}
                    className={`${themeFor(it.courseId, it.courseCode).className} flex flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-xl bg-surface py-3 pr-4 pl-0 text-sm shadow-sm transition hover:bg-surface-2`}
                  >
                    <span className="cc-bar h-8 w-1 self-stretch rounded-r" aria-hidden />
                    <span className="cc-text w-32 shrink-0 font-mono text-xs font-semibold">
                      {it.courseCode}{it.section && multiSection.has(it.courseId) ? ` · ${t("dash.section", { s: it.section })}` : ""}
                    </span>
                    <span className="badge bg-surface-3 text-muted">{t(it.kind === "quiz" ? "todo.kind.quiz" : "todo.kind.assignment")}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    {it.badges.map((b) => <span key={b.text} className={`badge ${TONE[b.tone]}`}>{b.text}</span>)}
                    {it.meta && <span className={`text-xs ${it.meta.warn ? "text-warning" : "text-subtle"}`}>{it.meta.text}</span>}
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
          {user.role === "ADMIN" && <Link href="/admin/courses" className="btn mt-4">{t("dash.setup")}</Link>}
        </div>
      ) : (
        <div className="space-y-10">
          {ordered.map((g) => (
            <section key={g.key} data-testid="course-group">
              {grouped && (
                <div className="cc mb-4 flex items-center gap-3" style={g.color ? { ["--cc" as string]: g.color } : undefined}>
                  {g.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.logo} alt="" className="h-10 w-auto max-w-[4.5rem] shrink-0 object-contain" data-testid="group-logo" />
                  )}
                  <div className="min-w-0">
                    <h2 className={`text-sm font-semibold ${g.color ? "cc-text" : ""}`}>{g.title ?? t("dep.other")}</h2>
                    {g.subtitle && <div className="text-xs text-subtle">{g.subtitle}</div>}
                  </div>
                  {g.color && <span className="cc-bar ml-2 h-px flex-1 opacity-40" aria-hidden />}
                </div>
              )}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.offerings.map((o) => {
                  const initials = o.course.code.replace(/[^A-Z]/g, "").slice(0, 3) || o.course.code.slice(0, 2);
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/courses/${o.id}`}
                        style={themeFor(o.courseId, o.course.code).style}
                        className={`${themeFor(o.courseId, o.course.code).className} group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg`}
                      >
                        <span className="cc-bar h-1.5" aria-hidden />
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex items-center gap-3">
                            <span className="cc-tint grid h-10 w-10 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold">{initials}</span>
                            <span className="cc-text font-mono text-xs font-semibold">{o.course.code}</span>
                            {multiSection.has(o.courseId) && (
                              <span className="badge ml-auto bg-surface-3 text-muted">{t("dash.section", { s: o.section })}</span>
                            )}
                          </div>
                          <div className="mt-4 font-medium leading-snug">{o.course.title}</div>
                          {o.course.titleTh && <div className="mt-0.5 text-sm text-muted">{o.course.titleTh}</div>}
                          <div className="mt-auto flex items-center justify-between pt-6 text-xs text-subtle">
                            <span className="truncate">{o.enrollments.map((e) => e.user.fullName).join(", ") || t("dash.noInstructor")}</span>
                            <span className="shrink-0 pl-2">{tn("dash.materials", o._count.materials)}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
