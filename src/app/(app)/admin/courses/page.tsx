import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { setCurrentTermAction } from "../actions";
import { CreateCourseForm, CreateOfferingForm, CreateTermForm, ImportScheduleForm } from "./forms";
import { Modal } from "@/components/Modal";
import { CourseDepartmentSelect } from "./CourseDepartmentSelect";

export async function generateMetadata() {
  return { title: (await getI18n()).t("tc.title") };
}

export default async function AdminCoursesPage() {
  const { t, term: termLabel, lang } = await getI18n();
  const [terms, courses] = await Promise.all([
    db.term.findMany({
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
      include: {
        offerings: {
          include: { course: true, _count: { select: { enrollments: { where: { role: "STUDENT" } } } } },
          orderBy: { course: { code: "asc" } },
        },
      },
    }),
    db.course.findMany({ orderBy: { code: "asc" }, include: { department: true } }),
  ]);
  const departments = await db.department.findMany({ orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { code: "asc" }], include: { parent: true } });
  const dName = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const deptOptions = departments.map((d) => ({ id: d.id, label: `${d.parent ? "— " : ""}${d.code} ${dName(d)}` }));

  const Step = ({ n, title }: { n: number; title: string }) => (
    <h2 className="card-title flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 font-mono text-[11px] text-muted">{n}</span>
      {title}
    </h2>
  );

  return (
    <div>
      <PageHeader title={t("tc.title")} description={t("tc.desc")} />
      <div className="-mt-3 mb-8 flex flex-wrap gap-2">
        <Modal label={t("sched.import")} title={t("sched.import")} buttonClassName="btn-secondary h-9" size="lg" testId="import-schedule"><ImportScheduleForm /></Modal>
        <Modal label={`+ ${t("tc.addTerm")}`} title={t("tc.addTerm")} buttonClassName="btn-secondary h-9" testId="add-term"><CreateTermForm /></Modal>
        <Modal label={`+ ${t("tc.addCourse")}`} title={t("tc.addCourse")} buttonClassName="btn-secondary h-9" testId="add-course"><CreateCourseForm departments={deptOptions} /></Modal>
        {terms.length && courses.length ? (
          <Modal label={`+ ${t("tc.offer")}`} title={t("tc.offer")} testId="offer-course">
            <CreateOfferingForm
              courses={courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` }))}
              terms={terms.map((x) => ({ id: x.id, label: termLabel(x), isCurrent: x.isCurrent }))}
            />
          </Modal>
        ) : (
          <span className="self-center text-xs text-subtle">{t("tc.needFirst")}</span>
        )}
      </div>

      {courses.length > 0 && (
        <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface" data-testid="course-catalog">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{t("tc.course")}</h2>
          <ul className="divide-y divide-border">
            {courses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-5">
                <span className="w-16 shrink-0 font-mono text-xs text-accent">{c.code}</span>
                <span className="min-w-[10rem] flex-1">
                  {c.title}
                  {c.titleTh && <span className="ml-2 text-xs text-subtle">{c.titleTh}</span>}
                </span>
                {departments.length > 0 ? (
                  <span className="w-full sm:w-auto">
                    <CourseDepartmentSelect courseId={c.id} value={c.departmentId ?? ""} options={deptOptions} noneLabel={t("dep.unassigned")} ariaLabel={`${t("dep.field")} ${c.code}`} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-6">
        {terms.map((tm) => (
          <section key={tm.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold">{termLabel(tm)}</h2>
              {tm.isCurrent ? (
                <span className="badge bg-emerald-500/10 text-success">{t("tc.current")}</span>
              ) : (
                <form action={setCurrentTermAction} className="ml-auto">
                  <input type="hidden" name="termId" value={tm.id} />
                  <button className="btn-secondary">{t("tc.makeCurrent")}</button>
                </form>
              )}
            </div>
            {tm.offerings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">{t("tc.noOfferings")}</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th className="pl-5">{t("tc.code")}</th><th>{t("tc.course")}</th><th>{t("tc.section")}</th><th>{t("tc.cadets")}</th><th /></tr></thead>
                <tbody>
                  {tm.offerings.map((o) => (
                    <tr key={o.id}>
                      <td className="pl-5 font-mono text-xs text-accent">{o.course.code}</td>
                      <td className="min-w-[10rem]">{o.course.title}</td>
                      <td className="text-muted">{o.section}</td>
                      <td className="text-muted">{o._count.enrollments}</td>
                      <td className="pr-5 text-right">
                        <Link href={`/admin/offerings/${o.id}`} className="btn-secondary whitespace-nowrap">{t("tc.manageRoster")}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
