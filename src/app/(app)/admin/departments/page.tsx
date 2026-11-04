import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { ConfirmButton } from "@/app/(app)/courses/[id]/grades/ConfirmButton";
import { deleteDepartmentAction } from "../actions";
import { DepartmentForm } from "./DepartmentForm";

export async function generateMetadata() {
  return { title: (await getI18n()).t("dep.title") };
}

export default async function DepartmentsPage() {
  const { t, tn, lang } = await getI18n();
  const all = await db.department.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    include: { _count: { select: { courses: true, users: true, children: true } } },
  });
  const label = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const divisions = all.filter((d) => !d.parentId);
  const divisionOptions = divisions.map((d) => ({ id: d.id, label: `${d.code} — ${label(d)}` }));

  const unit = (d: (typeof all)[number], kind: "division" | "department") => (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-mono text-xs text-accent">{d.code}</span>
      <div className="min-w-0 flex-1">
        <div className={kind === "division" ? "font-semibold" : ""}>{label(d)}</div>
        {d.nameTh && lang !== "th" && <div className="text-xs text-subtle">{d.nameTh}</div>}
      </div>
      <span className="text-xs text-subtle">{tn("dep.courses", d._count.courses)} · {tn("dep.people", d._count.users)}</span>
      <Modal label={t("qz.edit")} title={label(d)} buttonClassName="btn-secondary h-7">
        <DepartmentForm id={d.id} divisions={divisionOptions} defaults={{ code: d.code, name: d.name, nameTh: d.nameTh ?? "", parentId: d.parentId ?? "" }} />
      </Modal>
      {d._count.children === 0 && (
        <ConfirmButton action={deleteDepartmentAction} name="departmentId" value={d.id} message={t("dep.deleteConfirm")} label={t("qz.delete")} />
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t("dep.title")}
        description={t("dep.desc")}
        actions={
          <Modal label={`+ ${t("dep.add")}`} title={t("dep.add")} testId="add-department">
            <DepartmentForm divisions={divisionOptions} />
          </Modal>
        }
      />
      {divisions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("dep.none")}</div>
      ) : (
        <div className="space-y-4">
          {divisions.map((div) => (
            <section key={div.id} className="overflow-hidden rounded-xl border border-border bg-surface" data-testid="division">
              <div className="border-b border-border bg-surface-2 px-5 py-3">{unit(div, "division")}</div>
              <ul className="divide-y divide-border">
                {all.filter((d) => d.parentId === div.id).map((d) => (
                  <li key={d.id} className="px-5 py-3 pl-10">{unit(d, "department")}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
