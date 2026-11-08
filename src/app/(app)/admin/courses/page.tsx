import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { setCurrentTermAction } from "../actions";
import { CreateCourseForm, CreateOfferingForm, CreateTermForm, ImportScheduleForm } from "./forms";
import { Modal } from "@/components/Modal";
import { InfoTip } from "@/components/InfoTip";
import { CourseDepartmentSelect } from "./CourseDepartmentSelect";
import { deptColor, deptLogo } from "@/lib/departments";

/** Bulk imports run as server actions from this page: hashing dozens of passwords takes ~15 s, so allow 60 s on Vercel. */
export const maxDuration = 60;

export async function generateMetadata() {
  return { title: (await getI18n()).t("tc.title") };
}

type Dept = Awaited<ReturnType<typeof loadDepartments>>[number];
const loadDepartments = () =>
  db.department.findMany({ orderBy: [{ position: "asc" }, { code: "asc" }], include: { parent: true } });

/**
 * Two views: a semester (its course sections, grouped by subject area) and the course catalogue
 * (every course once, grouped the same way). Semesters are chips; the current one is the default.
 */
export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ view?: string; s?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "catalog" ? "catalog" : "semesters";
  const { t, tn, term: termLabel, lang } = await getI18n();

  const [terms, courses, departments] = await Promise.all([
    db.term.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] }),
    db.course.findMany({ orderBy: { code: "asc" }, include: { department: { include: { parent: true } } } }),
    loadDepartments(),
  ]);
  const name = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const deptOptions = [...departments]
    .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || a.code.localeCompare(b.code))
    .map((d) => ({ id: d.id, label: `${d.parent ? "— " : ""}${d.code} ${name(d)}` }));
  const current = terms.find((x) => x.isCurrent) ?? null;
  const selected = terms.find((x) => x.id === sp.s) ?? current ?? terms[0] ?? null;
  const isUpcoming = (x: { academicYear: number; semester: number }) =>
    !!current && (x.academicYear > current.academicYear || (x.academicYear === current.academicYear && x.semester > current.semester));

  // Group anything with a department by subject area, in the departments' order; unassigned last.
  const pos = new Map(departments.map((d, i) => [d.id, i]));
  const groupBy = <T,>(items: T[], deptOf: (x: T) => Dept | null) => {
    const m = new Map<string, { dept: Dept | null; items: T[] }>();
    for (const it of items) {
      const d = deptOf(it);
      const k = d?.id ?? "";
      if (!m.has(k)) m.set(k, { dept: d, items: [] });
      m.get(k)!.items.push(it);
    }
    return [...m.values()].sort((a, b) => (a.dept ? pos.get(a.dept.id)! : 1e9) - (b.dept ? pos.get(b.dept.id)! : 1e9));
  };
  const GroupHeader = ({ dept, count }: { dept: Dept | null; count: string }) => {
    const logo = dept ? deptLogo({ ...dept, parent: dept.parent }) : null;
    return (
      <div
        className="cc flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 sm:px-5"
        style={dept ? { ["--cc" as string]: deptColor({ ...dept, parent: dept.parent }) ?? "var(--color-accent)" } : undefined}
        data-testid="course-group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="" className="h-6 w-auto max-w-10 object-contain" /> : <span className="cc-bar h-4 w-1 rounded" />}
        <span className="min-w-0 flex-1 text-sm font-semibold">
          {dept ? <><span className="cc-text font-mono">{dept.code}</span> {name(dept)}</> : t("dep.unassigned")}
          {dept?.parent && <span className="ml-1.5 text-xs font-normal text-subtle">· {name(dept.parent)}</span>}
        </span>
        <span className="text-xs text-subtle">{count}</span>
      </div>
    );
  };

  const tab = (v: "semesters" | "catalog", label: string) => (
    <Link
      href={v === "catalog" ? "/admin/courses?view=catalog" : "/admin/courses"}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${view === v ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
      data-testid={`tab-${v}`}
    >
      {label}
    </Link>
  );

  // ---------- Semester view data ----------
  const offerings = selected
    ? await db.courseOffering.findMany({
        where: { termId: selected.id },
        include: {
          course: { include: { department: { include: { parent: true } } } },
          enrollments: { where: { role: "INSTRUCTOR" }, include: { user: { select: { fullName: true } } } },
          _count: { select: { enrollments: { where: { role: "STUDENT" } } } },
        },
        orderBy: [{ course: { code: "asc" } }, { section: "asc" }],
      })
    : [];

  return (
    <div>
      <PageHeader
        title={t("tc.title")}
        help={t("tc.desc")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Modal label={t("sched.import")} title={t("sched.import")} buttonClassName="btn-secondary h-9" size="lg" testId="import-schedule"><ImportScheduleForm /></Modal>
            <Modal label={`+ ${t("tc.addTerm")}`} title={t("tc.addTerm")} buttonClassName="btn-secondary h-9" testId="add-term"><CreateTermForm /></Modal>
            <Modal label={`+ ${t("tc.addCourse")}`} title={t("tc.addCourse")} buttonClassName="btn-secondary h-9" testId="add-course"><CreateCourseForm departments={deptOptions} /></Modal>
          </div>
        }
      />
      <nav className="mb-5 flex gap-1 border-b border-border pb-3">
        {tab("semesters", t("tc.tab.semesters"))}
        {tab("catalog", t("tc.tab.catalog", { n: courses.length }))}
      </nav>

      {view === "semesters" ? (
        terms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("dash.noTerms")}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2" data-testid="semester-chips">
              {terms.map((x) => (
                <Link
                  key={x.id}
                  href={`/admin/courses?s=${x.id}`}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    selected?.id === x.id ? "border-accent/50 bg-accent/15 text-fg" : "border-border text-muted hover:bg-surface-3 hover:text-fg"
                  }`}
                >
                  {termLabel(x)}
                  {x.isCurrent && <span className="badge bg-emerald-500/10 text-success">{t("tc.current")}</span>}
                  {isUpcoming(x) && <span className="badge bg-accent/10 text-accent">{t("tc.upcoming")}</span>}
                </Link>
              ))}
            </div>

            {selected && (
              <section className="overflow-hidden rounded-xl border border-border bg-surface" data-testid="semester-view">
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <h2 className="text-base font-semibold">{termLabel(selected)}</h2>
                  <span className="text-xs text-subtle">{tn("tc.sections", offerings.length)}</span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {!selected.isCurrent && (
                      <form action={setCurrentTermAction}>
                        <input type="hidden" name="termId" value={selected.id} />
                        <button className="btn-secondary">{t("tc.makeCurrent")}</button>
                      </form>
                    )}
                    {courses.length > 0 && <span className="self-center"><InfoTip text={t("tc.offerHelp")} align="end" /></span>}
                    {courses.length > 0 && (
                      <Modal label={`+ ${t("tc.offer")}`} title={t("tc.offer")} buttonClassName="btn h-8 px-3 text-xs" testId="offer-course">
                        <CreateOfferingForm
                          courses={courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` }))}
                          terms={terms.map((x) => ({ id: x.id, label: termLabel(x), isCurrent: x.isCurrent }))}
                          defaultTermId={selected.id}
                        />
                      </Modal>
                    )}
                  </div>
                </div>
                {offerings.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted">{t("tc.noOfferings")}</p>
                ) : (
                  groupBy(offerings, (o) => o.course.department).map((g) => (
                    <div key={g.dept?.id ?? "none"}>
                      <GroupHeader dept={g.dept} count={tn("tc.sections", g.items.length)} />
                      <ul className="divide-y divide-border">
                        {g.items.map((o) => (
                          <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:px-5" data-testid="offering-row">
                            <span className="w-16 shrink-0 font-mono text-xs text-accent">{o.course.code}</span>
                            <span className="min-w-[12rem] flex-1">
                              <span>{o.course.title}</span>
                              {o.section !== "1" && <span className="ml-1.5 text-xs text-subtle">· {t("tc.section")} {o.section}</span>}
                              <span className="block text-xs text-subtle">
                                {o.enrollments.length ? o.enrollments.map((e) => e.user.fullName).join(", ") : <span className="text-warning">{t("tc.noInstructor")}</span>}
                              </span>
                            </span>
                            <span className="text-xs text-muted">{tn("tc.cadetCount", o._count.enrollments)}</span>
                            <Link href={`/admin/offerings/${o.id}`} className="btn-secondary whitespace-nowrap">{t("tc.manageRoster")}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-surface" data-testid="course-catalog">
          {courses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">{t("tc.noCourses")}</p>
          ) : (
            groupBy(courses, (c) => c.department).map((g) => (
              <div key={g.dept?.id ?? "none"}>
                <GroupHeader dept={g.dept} count={tn("tc.courseCount", g.items.length)} />
                <ul className="divide-y divide-border">
                  {g.items.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-5">
                      <span className="w-16 shrink-0 font-mono text-xs text-accent">{c.code}</span>
                      <span className="min-w-[10rem] flex-1">
                        {c.title}
                        {c.titleTh && <span className="ml-2 text-xs text-subtle">{c.titleTh}</span>}
                        {c.description && <span className="block text-xs text-subtle">{c.description}</span>}
                      </span>
                      {departments.length > 0 && (
                        <span className="w-full sm:w-auto">
                          <CourseDepartmentSelect courseId={c.id} value={c.departmentId ?? ""} options={deptOptions} noneLabel={t("dep.unassigned")} ariaLabel={`${t("dep.field")} ${c.code}`} />
                        </span>
                      )}
                      <Modal label={t("qz.edit")} title={`${t("tc.editCourse")} · ${c.code}`} buttonClassName="btn-secondary" size="lg" testId="edit-course">
                        <CreateCourseForm
                          departments={deptOptions}
                          course={{ id: c.id, code: c.code, title: c.title, titleTh: c.titleTh, credits: c.credits, description: c.description, departmentId: c.departmentId }}
                        />
                      </Modal>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
