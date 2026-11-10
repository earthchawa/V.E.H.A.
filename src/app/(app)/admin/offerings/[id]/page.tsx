import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { unenrollAction } from "../../actions";
import { EnrollForm } from "./EnrollForm";
import { Modal } from "@/components/Modal";
import { DeleteOfferingForm } from "./DeleteOfferingForm";
import { ConfirmButton } from "../../../courses/[id]/grades/ConfirmButton";

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
      _count: { select: { materials: true, assignments: true, quizzes: true, gradeItems: true } },
    },
  });
  if (!offering) notFound();
  const submissions = await db.submission.count({ where: { assignment: { offeringId: offering.id } } });
  const { t, term: termLabel, role } = await getI18n();

  return (
    <div>
      <div className="mt-3">
        <PageHeader
          eyebrow={`${offering.course.code} · ${termLabel(offering.term)} · ${t("dash.section", { s: offering.section })}`}
          title={offering.course.title}
          actions={
            <div className="flex gap-2">
              <Modal label={`+ ${t("roster.add")}`} title={t("roster.add")} testId="add-people">
                <EnrollForm offeringId={offering.id} />
              </Modal>
              <Link href={`/courses/${offering.id}`} className="btn-secondary h-9">{t("roster.open")}</Link>
            </div>
          }
        />
      </div>
      <div>
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
                      <ConfirmButton action={unenrollAction} name="enrollmentId" value={e.id} message={t("roster.removeConfirm", { name: e.user.fullName })} label={t("roster.remove")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 px-5 py-4" data-testid="danger-zone">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{t("off.del.title")}</h2>
            <p className="mt-0.5 text-xs text-muted">{t("off.del.desc")}</p>
          </div>
          <Modal label={t("off.del.title")} title={`${t("off.del.title")} · ${offering.course.code} ${t("dash.section", { s: offering.section })}`} buttonClassName="btn-danger" testId="delete-offering">
            <DeleteOfferingForm
              offeringId={offering.id}
              code={offering.course.code}
              counts={{ people: offering.enrollments.length, ...offering._count, submissions }}
            />
          </Modal>
        </section>
      </div>
    </div>
  );
}
