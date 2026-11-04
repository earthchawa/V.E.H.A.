import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { unenrollAction } from "../../actions";
import { EnrollForm } from "./EnrollForm";

export default async function OfferingAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offering = await db.courseOffering.findUnique({
    where: { id },
    include: {
      course: true,
      term: true,
      enrollments: {
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: [{ role: "desc" }, { user: { username: "asc" } }],
      },
    },
  });
  if (!offering) notFound();
  const { t, term: termLabel, role } = await getI18n();

  return (
    <div>
      <Link href="/admin/courses" className="text-xs text-muted transition hover:text-fg">{t("roster.back")}</Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={`${offering.course.code} · ${termLabel(offering.term)} · ${t("dash.section", { s: offering.section })}`}
          title={offering.course.title}
          actions={<Link href={`/courses/${offering.id}`} className="btn-secondary h-9">{t("roster.open")}</Link>}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section className="card"><h2 className="card-title">{t("roster.add")}</h2><EnrollForm offeringId={offering.id} /></section>
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
            {t("roster.title")} <span className="font-normal text-subtle">{offering.enrollments.length}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th className="pl-5">{t("login.id")}</th><th>{t("users.fullName")}</th><th>{t("account.role")}</th><th /></tr></thead>
              <tbody>
                {offering.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="pl-5 font-mono text-xs">{e.user.username}</td>
                    <td>{e.user.fullName}</td>
                    <td>
                      <span className={`badge ${e.role === "INSTRUCTOR" ? "bg-accent/15 text-accent" : "bg-surface-3 text-muted"}`}>
                        {role(e.role === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT")}
                      </span>
                    </td>
                    <td className="pr-5 text-right">
                      <form action={unenrollAction}>
                        <input type="hidden" name="enrollmentId" value={e.id} />
                        <button className="btn-danger">{t("roster.remove")}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
