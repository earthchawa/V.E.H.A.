import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { setCurrentTermAction } from "../actions";
import { CreateCourseForm, CreateOfferingForm, CreateTermForm } from "./forms";

export async function generateMetadata() {
  return { title: (await getI18n()).t("tc.title") };
}

export default async function AdminCoursesPage() {
  const { t, term: termLabel } = await getI18n();
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
    db.course.findMany({ orderBy: { code: "asc" } }),
  ]);

  const Step = ({ n, title }: { n: number; title: string }) => (
    <h2 className="card-title flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 font-mono text-[11px] text-muted">{n}</span>
      {title}
    </h2>
  );

  return (
    <div>
      <PageHeader title={t("tc.title")} description={t("tc.desc")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card"><Step n={1} title={t("tc.addTerm")} /><CreateTermForm /></section>
        <section className="card"><Step n={2} title={t("tc.addCourse")} /><CreateCourseForm /></section>
        <section className="card">
          <Step n={3} title={t("tc.offer")} />
          {terms.length && courses.length ? (
            <CreateOfferingForm
              courses={courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` }))}
              terms={terms.map((x) => ({ id: x.id, label: termLabel(x), isCurrent: x.isCurrent }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("tc.needFirst")}</p>
          )}
        </section>
      </div>

      <div className="mt-10 space-y-6">
        {terms.map((tm) => (
          <section key={tm.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
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
              <table className="table">
                <thead><tr><th className="pl-5">{t("tc.code")}</th><th>{t("tc.course")}</th><th>{t("tc.section")}</th><th>{t("tc.cadets")}</th><th /></tr></thead>
                <tbody>
                  {tm.offerings.map((o) => (
                    <tr key={o.id}>
                      <td className="pl-5 font-mono text-xs text-accent">{o.course.code}</td>
                      <td>{o.course.title}</td>
                      <td className="text-muted">{o.section}</td>
                      <td className="text-muted">{o._count.enrollments}</td>
                      <td className="pr-5 text-right">
                        <Link href={`/admin/offerings/${o.id}`} className="btn-secondary">{t("tc.manageRoster")}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
