import Link from "next/link";
import { db } from "@/lib/db";
import { termLabel } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { setCurrentTermAction } from "../actions";
import { CreateCourseForm, CreateOfferingForm, CreateTermForm } from "./forms";

export const metadata = { title: "Terms & courses" };

export default async function AdminCoursesPage() {
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
      <PageHeader title="Terms & courses" description="Set up a term, add courses to the catalogue, then offer them in a term." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card"><Step n={1} title="Add term" /><CreateTermForm /></section>
        <section className="card"><Step n={2} title="Add course" /><CreateCourseForm /></section>
        <section className="card">
          <Step n={3} title="Offer in a term" />
          {terms.length && courses.length ? (
            <CreateOfferingForm
              courses={courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` }))}
              terms={terms.map((t) => ({ id: t.id, label: termLabel(t), isCurrent: t.isCurrent }))}
            />
          ) : (
            <p className="text-sm text-muted">Add a term and a course first.</p>
          )}
        </section>
      </div>

      <div className="mt-10 space-y-6">
        {terms.map((t) => (
          <section key={t.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">{termLabel(t)}</h2>
              {t.isCurrent ? (
                <span className="badge bg-emerald-500/10 text-emerald-300">Current</span>
              ) : (
                <form action={setCurrentTermAction} className="ml-auto">
                  <input type="hidden" name="termId" value={t.id} />
                  <button className="btn-secondary">Make current</button>
                </form>
              )}
            </div>
            {t.offerings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No courses offered yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th className="pl-5">Code</th><th>Course</th><th>Section</th><th>Cadets</th><th /></tr></thead>
                <tbody>
                  {t.offerings.map((o) => (
                    <tr key={o.id}>
                      <td className="pl-5 font-mono text-xs text-accent">{o.course.code}</td>
                      <td>{o.course.title}</td>
                      <td className="text-muted">{o.section}</td>
                      <td className="text-muted">{o._count.enrollments}</td>
                      <td className="pr-5 text-right">
                        <Link href={`/admin/offerings/${o.id}`} className="btn-secondary">Manage roster</Link>
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
