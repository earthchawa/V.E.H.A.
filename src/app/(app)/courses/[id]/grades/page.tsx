import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { computeStudent, formatPct, formatPoints, gradePoints, normaliseScale } from "@/lib/grades";
import { GradeGrid } from "./GradeGrid";
import { AddCategoryForm, AddItemForm, CategoryRowForm, ScaleForm } from "./SetupForms";
import { ConfirmButton } from "./ConfirmButton";
import { deleteCategoryAction, deleteItemAction, toggleItemReleaseAction, toggleShowTotalAction } from "./actions";

export async function generateMetadata() {
  return { title: (await getI18n()).t("course.tab.grades") };
}

export default async function GradesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const { t } = await getI18n();

  const [categories, items] = await Promise.all([
    db.gradeCategory.findMany({ where: { offeringId: offering.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.gradeItem.findMany({
      where: { offeringId: offering.id, ...(canManage ? {} : { isReleased: true }) },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignment: { select: { id: true } } },
    }),
  ]);
  const scale = normaliseScale(offering.gradeScale);
  const cats = categories.map((c) => ({ id: c.id, name: c.name, weight: c.weight }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  // ---------- Cadet view ----------
  if (!canManage) {
    const grades = await db.grade.findMany({ where: { studentId: user.id, itemId: { in: items.map((i) => i.id) } } });
    const byItem = new Map(grades.map((g) => [g.itemId, g]));
    const result = computeStudent(cats, items, new Map(grades.map((g) => [g.itemId, g.points])), { releasedOnly: true, scale });
    const groups = [...cats.map((c) => ({ id: c.id as string | null, name: c.name, weight: c.weight as number | null })), { id: null, name: t("gr.noCategory"), weight: null }]
      .map((g) => ({ ...g, items: items.filter((i) => i.categoryId === g.id || (g.id === null && !catName.has(i.categoryId ?? ""))) }))
      .filter((g) => g.items.length);

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="space-y-6">
          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">{t("gr.nothingReleased")}</div>
          )}
          {groups.map((g) => {
            const cr = result.categories.find((c) => c.id === g.id);
            return (
              <div key={g.id ?? "none"} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm">
                  <span className="font-semibold">{g.name}{g.weight != null && <span className="font-normal text-subtle"> · {g.weight}%</span>}</span>
                  {cr && <span className="font-mono text-muted">{formatPct(cr.pct)}</span>}
                </div>
                <ul className="divide-y divide-border">
                  {g.items.map((i) => {
                    const gr = byItem.get(i.id);
                    return (
                      <li key={i.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span>{i.title}</span>
                          <span className="font-mono text-sm" data-testid="my-score">
                            {gr?.points != null ? <>{formatPoints(gr.points)} <span className="text-subtle">/ {formatPoints(i.maxPoints)}</span></> : <span className="text-subtle">{t("gr.notGraded")}</span>}
                          </span>
                        </div>
                        {gr?.feedback && (
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
                            <span className="mb-0.5 block text-xs font-medium text-subtle">{t("gr.feedback")}</span>
                            {gr.feedback}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
        <aside>
          <section className="card lg:sticky lg:top-20">
            <h2 className="card-title">{t("gr.current")}</h2>
            {offering.showTotalToStudents ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold" data-testid="my-letter">{result.letter ?? "—"}</span>
                  <span className="font-mono text-muted">{formatPct(result.totalPct)}</span>
                </div>
                {gradePoints(result.letter) != null && <p className="mt-1 text-xs text-subtle">GPA {gradePoints(result.letter)!.toFixed(1)}</p>}
                <p className="mt-3 text-xs text-subtle">{t("gr.currentHint")}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{t("gr.totalHidden")}</p>
            )}
          </section>
        </aside>
      </div>
    );
  }

  // ---------- Instructor view ----------
  const grades = await db.grade.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
  const initial: Record<string, number | null> = {};
  for (const g of grades) initial[`${g.itemId}:${g.studentId}`] = g.points;
  const weightSum = categories.reduce((n, c) => n + c.weight, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("gr.title")}</h2>
        <a href={`/api/offerings/${offering.id}/grades`} className="btn-secondary h-9">{t("gr.export")}</a>
      </div>

      <GradeGrid
        offeringId={offering.id}
        categories={cats}
        items={items.map((i) => ({ id: i.id, title: i.title, maxPoints: i.maxPoints, categoryId: i.categoryId, isReleased: i.isReleased }))}
        students={students.map((e) => e.user)}
        initial={initial}
        scale={scale}
      />

      <details className="group rounded-xl border border-border bg-surface" open={items.length === 0}>
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold">
          {t("gr.setup")} <span className="inline-block text-subtle transition group-open:rotate-90">›</span>
        </summary>
        <div className="grid gap-6 border-t border-border p-5 lg:grid-cols-2">
          <section>
            <h3 className="card-title">{t("gr.categories")}</h3>
            {categories.length === 0 ? (
              <p className="mb-3 text-sm text-muted">{t("gr.noCategories")}</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <div className="flex-1"><CategoryRowForm id={c.id} name={c.name} weight={c.weight} /></div>
                    <ConfirmButton action={deleteCategoryAction} name="categoryId" value={c.id} message={t("gr.deleteCategoryConfirm")} label={t("gr.delete")} />
                  </li>
                ))}
              </ul>
            )}
            {categories.length > 0 && (
              <p className={`mb-3 text-xs ${Math.abs(weightSum - 100) < 0.01 ? "text-subtle" : "text-warning"}`}>
                {t("gr.weightSum", { n: Math.round(weightSum * 100) / 100 })}
                {Math.abs(weightSum - 100) >= 0.01 && <> — {t("gr.weightWarn")}</>}
              </p>
            )}
            <AddCategoryForm offeringId={offering.id} />

            <h3 className="card-title mt-8">{t("gr.scale")}</h3>
            <p className="-mt-2 mb-3 text-xs text-muted">{t("gr.scaleHint")}</p>
            <ScaleForm offeringId={offering.id} scale={scale} />
            <form action={toggleShowTotalAction} className="mt-4">
              <input type="hidden" name="offeringId" value={offering.id} />
              <button className="flex items-center gap-2 text-sm text-muted hover:text-fg">
                <span className={`grid h-4 w-4 place-items-center rounded border ${offering.showTotalToStudents ? "border-accent bg-accent text-accent-fg" : "border-border-strong"}`}>
                  {offering.showTotalToStudents && "✓"}
                </span>
                {t("gr.showTotal")}
              </button>
            </form>
          </section>

          <section>
            <h3 className="card-title">{t("gr.items")}</h3>
            {items.length > 0 && (
              <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
                {items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{i.title}</div>
                      <div className="text-xs text-subtle">
                        /{formatPoints(i.maxPoints)} · {i.categoryId ? catName.get(i.categoryId) : t("gr.noCategory")}
                        {i.assignment && <> · {t("gr.linked")}</>}
                      </div>
                    </div>
                    <form action={toggleItemReleaseAction}>
                      <input type="hidden" name="itemId" value={i.id} />
                      <button className={`badge ${i.isReleased ? "bg-emerald-500/10 text-success" : "bg-surface-3 text-muted"}`} title={t(i.isReleased ? "gr.hide" : "gr.release")}>
                        {t(i.isReleased ? "gr.released" : "gr.hidden")}
                      </button>
                    </form>
                    <ConfirmButton action={deleteItemAction} name="itemId" value={i.id} message={t("gr.deleteItemConfirm")} label={t("gr.delete")} />
                  </li>
                ))}
              </ul>
            )}
            <AddItemForm offeringId={offering.id} categories={cats} />
          </section>
        </div>
      </details>
    </div>
  );
}
