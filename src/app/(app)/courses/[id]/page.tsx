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
import { MoreMenu, MenuConfirm } from "@/components/MoreMenu";
import { copyMaterialAction, deleteMaterialAction, toggleMaterialAction } from "./actions";

export default async function CourseMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const siblings = canManage ? await siblingSections(user, offering.id) : [];
  const { t, lang } = await getI18n();

  const materials = await db.material.findMany({
    where: { offeringId: offering.id, ...(canManage ? {} : { isPublished: true }) },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });
  // Cadets grouped by year level (in this semester's academic year) and programme, for the side panel.
  const profiles = canManage
    ? await db.user.findMany({
        where: { id: { in: students.map((e) => e.user.id) } },
        select: {
          id: true,
          department: { select: { code: true, name: true, nameTh: true } },
          cadetYears: { where: { academicYear: offering.term.academicYear }, select: { yearLevel: true } },
        },
      })
    : [];
  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  const groupMap = new Map<string, { key: string; level: number | null; dept: string | null; cadets: (typeof students)[number]["user"][] }>();
  for (const e of students) {
    const p = profileOf.get(e.user.id);
    const level = p?.cadetYears[0]?.yearLevel ?? null;
    const d = p?.department;
    const key = `${level ?? 99}|${d?.code ?? "~"}`;
    const g = groupMap.get(key) ?? { key, level, dept: d ? (lang === "th" && d.nameTh ? d.nameTh : d.name) : null, cadets: [] };
    g.cadets.push(e.user);
    groupMap.set(key, g);
  }
  const groupLabel = (g: { level: number | null; dept: string | null }) =>
    `${g.level != null ? t("yl.level", { n: g.level }) : t("yl.none")} · ${g.dept ?? t("course.noDept")}`;
  const cadetGroups = [...groupMap.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  const byWeek = new Map<number | null, Material[]>();
  for (const m of materials) byWeek.set(m.week, [...(byWeek.get(m.week) ?? []), m]);
  const groups = [...byWeek.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));

  return (
    <div>
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
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {items.map((m) => {
                    const href = m.type === "FILE" ? `/api/materials/${m.id}/download` : m.url!;
                    const link = m.type === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {};
                    return (
                      <li key={m.id} className="row-link relative flex flex-wrap items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl" data-testid="material-row">
                        <span className="badge w-10 justify-center bg-surface-3 font-mono text-muted">
                          {m.type === "FILE" ? (m.fileName?.split(".").pop()?.slice(0, 4).toUpperCase() ?? "FILE") : "LINK"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* The title link covers the whole row; the controls on the right sit above it. */}
                            <a href={href} {...link} className="font-medium after:absolute after:inset-0 after:rounded-[inherit]">
                              {m.title}
                            </a>
                            {!m.isPublished && <span className="badge bg-amber-500/10 text-warning">{t("course.hidden")}</span>}
                          </div>
                          {m.description && <p className="mt-0.5 text-sm text-muted">{m.description}</p>}
                          {m.fileName && (
                            <p className="mt-0.5 break-all text-xs text-subtle">
                              {m.fileName} · {formatBytes(m.sizeBytes)}
                            </p>
                          )}
                        </div>
                        <div className={`relative z-[1] flex items-center gap-2 ${canManage ? "w-full justify-end sm:w-auto" : ""}`}>
                          {canManage && (
                            <form action={toggleMaterialAction}>
                              <input type="hidden" name="materialId" value={m.id} />
                              <button role="switch" aria-checked={m.isPublished} className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-xs text-muted transition hover:text-fg" data-testid="material-visible">
                                <span className="toggle" data-on={m.isPublished} />
                                {t("mat.visible")}
                              </button>
                            </form>
                          )}
                          {!canManage && (
                            <span className="grid h-9 w-9 place-items-center text-muted" aria-hidden>
                              {m.type === "FILE" ? "↓" : "↗"}
                            </span>
                          )}
                          {canManage && (
                            <MoreMenu testId="material-more">
                              <a href={href} {...link} className="menu-item" data-testid="material-download">
                                <span className="menu-icon" aria-hidden>{m.type === "FILE" ? "↓" : "↗"}</span>
                                {t(m.type === "FILE" ? "mat.download" : "mat.openLink")}
                              </a>
                              <CopyToSections action={copyMaterialAction} itemId={m.id} sections={siblings} kind="material" itemTitle={m.title} menuItem />
                              <MenuConfirm
                                action={deleteMaterialAction}
                                name="materialId"
                                value={m.id}
                                message={t("mat.deleteConfirm", { title: m.title })}
                                label={t("course.delete")}
                                icon="✕"
                                testId="material-delete"
                              />
                            </MoreMenu>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {canManage && (
          <aside className={`space-y-6 ${groups.length ? "lg:mt-6" : ""}`}>
            <section className="card" data-testid="course-cadets">
              <h2 className="card-title">{t("course.cadets")} <span className="font-normal text-subtle">{students.length}</span></h2>
              {/* Year level (this semester's academic year) and programme: one line when everyone shares them,
                  otherwise a heading with a count per group. */}
              {cadetGroups.length === 1 && <p className="-mt-3 mb-3 text-xs text-muted" data-testid="cadet-group">{groupLabel(cadetGroups[0])}</p>}
              <div className="max-h-96 space-y-4 overflow-y-auto pr-3 text-sm">
                {cadetGroups.map((g) => (
                  <div key={g.key}>
                    {cadetGroups.length > 1 && (
                      <h3 className="mb-1.5 flex items-baseline gap-2 border-b border-border pb-1 text-xs font-medium text-muted" data-testid="cadet-group">
                        <span className="min-w-0 flex-1">{groupLabel(g)}</span>
                        <span className="font-normal text-subtle">{g.cadets.length}</span>
                      </h3>
                    )}
                    <ul className="space-y-1.5">
                      {g.cadets.map((u) => (
                        <li key={u.id} className="flex gap-3">
                          <span className="font-mono text-xs leading-5 text-subtle">{u.username}</span>
                          <span>{u.fullName}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
