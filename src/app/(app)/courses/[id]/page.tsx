import type { Material } from "@prisma/client";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { config } from "@/lib/config";
import { siblingSections } from "@/lib/sections";
import { CopyToSections } from "@/components/CopyToSections";
import { Modal } from "@/components/Modal";
import { getI18n } from "@/lib/i18n/server";
import { AddMaterialForm } from "./AddMaterialForm";
import { ConfirmButton } from "./grades/ConfirmButton";
import { copyMaterialAction, deleteMaterialAction, toggleMaterialAction } from "./actions";

export default async function CourseMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const siblings = canManage ? await siblingSections(user, offering.id) : [];
  const { t, date } = await getI18n();

  const materials = await db.material.findMany({
    where: { offeringId: offering.id, ...(canManage ? {} : { isPublished: true }) },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });
  const byWeek = new Map<number | null, Material[]>();
  for (const m of materials) byWeek.set(m.week, [...(byWeek.get(m.week) ?? []), m]);
  const groups = [...byWeek.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));

  return (
    <div>
      {offering.course.description && <p className="-mt-2 mb-6 max-w-3xl text-sm text-muted">{offering.course.description}</p>}
      {canManage && (
        <div className="mb-6">
          <Modal label={`+ ${t("course.addMaterial")}`} title={t("course.addMaterial")} testId="add-material">
            <AddMaterialForm offeringId={offering.id} maxMb={config.maxUploadMb} sections={siblings} />
          </Modal>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          {groups.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">
              {t("course.noMaterials")}
            </div>
          )}
          <div className="space-y-8">
            {groups.map(([week, items]) => (
              <div key={week ?? "none"}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">
                  {week == null ? t("course.general") : week === 0 ? t("course.beforeClass") : t("course.week", { n: week })}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {items.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="badge w-10 justify-center bg-surface-3 font-mono text-muted">
                        {m.type === "FILE" ? (m.fileName?.split(".").pop()?.slice(0, 4).toUpperCase() ?? "FILE") : "LINK"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={m.type === "FILE" ? `/api/materials/${m.id}/download` : m.url!}
                            target={m.type === "LINK" ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="font-medium transition hover:text-accent"
                          >
                            {m.title}
                          </a>
                          {!m.isPublished && <span className="badge bg-amber-500/10 text-warning">{t("course.hidden")}</span>}
                        </div>
                        {m.description && <p className="mt-0.5 text-sm text-muted">{m.description}</p>}
                        <p className="mt-0.5 text-xs text-subtle">
                          {m.fileName && `${m.fileName} · ${formatBytes(m.sizeBytes)} · `}
                          {date(m.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyToSections action={copyMaterialAction} itemId={m.id} sections={siblings} kind="material" itemTitle={m.title} />
                          <form action={toggleMaterialAction}>
                            <input type="hidden" name="materialId" value={m.id} />
                            <button role="switch" aria-checked={m.isPublished} className="flex h-8 items-center gap-2 rounded-lg px-1.5 text-xs text-muted transition hover:text-fg" data-testid="material-visible">
                              <span className="toggle" data-on={m.isPublished} />
                              {t("mat.visible")}
                            </button>
                          </form>
                          <ConfirmButton action={deleteMaterialAction} name="materialId" value={m.id} message={t("mat.deleteConfirm", { title: m.title })} label={t("course.delete")} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {canManage && (
          <aside className="space-y-6">
            <section className="card">
              <h2 className="card-title">{t("course.cadets")} <span className="font-normal text-subtle">{students.length}</span></h2>
              <ul className="max-h-96 space-y-1.5 overflow-y-auto text-sm">
                {students.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="font-mono text-xs leading-5 text-subtle">{e.user.username}</span>
                    <span>{e.user.fullName}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
