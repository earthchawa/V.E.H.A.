import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { ConfirmButton } from "@/app/(app)/courses/[id]/grades/ConfirmButton";
import { deleteDepartmentAction } from "../actions";
import { DepartmentForm, type DivisionOption } from "./DepartmentForm";
import { deptColor, deptLogo } from "@/lib/departments";

export async function generateMetadata() {
  return { title: (await getI18n()).t("dep.title") };
}

export default async function DepartmentsPage() {
  const { t, tn, lang } = await getI18n();
  const all = await db.department.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    include: { parent: true, _count: { select: { courses: true, users: true, children: true } } },
  });
  const label = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const divisions = all.filter((d) => !d.parentId);
  const divisionOptions: DivisionOption[] = divisions.map((d) => ({
    id: d.id,
    label: `${d.code} — ${label(d)}`,
    color: d.color,
    logo: deptLogo(d),
  }));

  const unit = (d: (typeof all)[number], kind: "division" | "department") => (
    <div className="cc flex flex-wrap items-center gap-3" style={{ ["--cc" as string]: deptColor(d) ?? "var(--color-accent)" }}>
      {deptLogo(d) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={deptLogo(d)!} alt="" className={`${kind === "division" ? "h-10 max-w-[4.5rem]" : "h-7 max-w-12"} w-auto object-contain`} data-testid="dep-logo" />
      ) : (
        <span className={`cc-tint grid ${kind === "division" ? "h-10 w-10" : "h-7 w-7"} place-items-center rounded-lg font-mono text-[10px] font-bold`}>{d.code.slice(0, 3)}</span>
      )}
      <span className="cc-text font-mono text-xs font-semibold">{d.code}</span>
      <div className="min-w-0 flex-1">
        <div className={kind === "division" ? "font-semibold" : ""}>{label(d)}</div>
        {d.nameTh && lang !== "th" && <div className="text-xs text-subtle">{d.nameTh}</div>}
      </div>
      <span className="text-xs text-subtle">{tn("dep.courses", d._count.courses)} · {tn("dep.people", d._count.users)}</span>
      <span className="cc-bar h-5 w-1.5 rounded" title={deptColor(d) ?? ""} />
      <Modal label={t("qz.edit")} title={label(d)} buttonClassName="btn-secondary h-7" size="lg">
        <DepartmentForm
          id={d.id}
          divisions={divisionOptions}
          defaults={{
            code: d.code,
            name: d.name,
            nameTh: d.nameTh ?? "",
            parentId: d.parentId ?? "",
            color: d.color,
            logoUrl: d.logoUrl,
            uploadedLogo: d.logoKey ? `/api/department-logo/${d.id}?v=${d.logoKey.slice(0, 8)}` : null,
          }}
        />
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
          <Modal label={`+ ${t("dep.add")}`} title={t("dep.add")} size="lg" testId="add-department">
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
