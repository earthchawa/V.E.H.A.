import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { computeStudent, formatPct, formatPoints, gradePoints, normaliseScale } from "@/lib/grades";
import { GradeGrid } from "./GradeGrid";
import { AddCategoryForm, AddItemForm, CategoryRowForm, ScaleForm } from "./SetupForms";
import { ConfirmButton } from "./ConfirmButton";
import { applyGradeTemplateAction, copyGradebookSetupAction, deleteCategoryAction, deleteItemAction, toggleItemReleaseAction, toggleShowTotalAction } from "./actions";
import Link from "next/link";
import { siblingSections } from "@/lib/sections";
import { CopyToSections } from "@/components/CopyToSections";

export async function generateMetadata() {
  return { title: (await getI18n()).t("course.tab.grades") };
}

export default async function GradesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { view } = await searchParams;
  const { user, offering, canManage, canGrade, students } = await loadCourse(id);
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

  // ---------- Instructor view: two tabs, the score table and the grading setup ----------
  const grades = await db.grade.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
  const initial: Record<string, number | null> = {};
  for (const g of grades) initial[`${g.itemId}:${g.studentId}`] = g.points;
  const weightSum = categories.reduce((n, c) => n + c.weight, 0);
  const weightsOk = categories.length === 0 || Math.abs(weightSum - 100) < 0.01;
  const siblings = await siblingSections(user, offering.id);
  const base = `/courses/${offering.id}/grades`;
  // Read-only viewers (admins) never see the setup; instructors land on setup until there is something to score.
  const showSetup = canGrade && (view === "setup" || (view !== "scores" && items.length === 0));
  const tab = (setup: boolean, label: string, testId: string) => (
    <Link
      href={setup ? `${base}?view=setup` : `${base}?view=scores`}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${showSetup === setup ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
      data-testid={testId}
    >
      {label}
    </Link>
  );
  const Step = ({ n, title, hint, children, testId }: { n: number; title: string; hint: string; children: React.ReactNode; testId: string }) => (
    <section className="card" data-testid={testId}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-xs text-accent">{n}</span>
        {title}
      </h3>
      <p className="mt-1.5 mb-4 text-xs leading-relaxed text-muted">{hint}</p>
      {children}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{t("gr.title")}</h2>
        {canGrade && (
          <nav className="flex gap-1">
            {tab(false, t("gr.tab.scores"), "tab-scores")}
            {tab(true, t("gr.tab.setup"), "tab-setup")}
          </nav>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canGrade && <CopyToSections action={copyGradebookSetupAction} itemId={offering.id} sections={siblings} label={t("sec.copySetup")} hint={t("sec.copySetupHint")} />}
          <a href={`/api/offerings/${offering.id}/grades`} className="btn-secondary h-9">{t("gr.export")}</a>
        </div>
      </div>

      {!showSetup ? (
        <>
          {canGrade && !weightsOk && (
            <Link href={`${base}?view=setup`} className="block rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-warning">
              {t("gr.weightSum", { n: Math.round(weightSum * 100) / 100 })} — {t("gr.weightWarn")} {t("gr.fixInSetup")} →
            </Link>
          )}
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">
              {t("gr.noItems")}
              {canGrade && <div className="mt-3"><Link href={`${base}?view=setup`} className="btn">{t("gr.goSetup")}</Link></div>}
            </div>
          ) : (
            <GradeGrid
              offeringId={offering.id}
              categories={cats}
              items={items.map((i) => ({ id: i.id, title: i.title, maxPoints: i.maxPoints, categoryId: i.categoryId, isReleased: i.isReleased }))}
              students={students.map((e) => e.user)}
              initial={initial}
              scale={scale}
              readOnly={!canGrade}
            />
          )}
          {!canGrade && (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted" data-testid="grades-readonly">{t("gr.readOnly")}</p>
          )}
        </>
      ) : (
        <div className="space-y-6" data-testid="grade-setup">
          <p className="max-w-3xl text-sm leading-relaxed text-muted">{t("gr.setupIntro")}</p>

          <Step n={1} title={t("gr.categories")} hint={t("gr.categoriesHint")} testId="setup-categories">
            {categories.length === 0 ? (
              <div className="mb-4 rounded-lg border border-dashed border-border-strong p-4 text-sm">
                <p className="text-muted">{t("gr.noCategories")}</p>
                <form action={applyGradeTemplateAction} className="mt-3">
                  <input type="hidden" name="offeringId" value={offering.id} />
                  <button className="btn-secondary" data-testid="grade-template">{t("gr.useTemplate")}</button>
                </form>
              </div>
            ) : (
              <>
                {/* Weights at a glance */}
                <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  {categories.map((c, i) => (
                    <span key={c.id} className={`sw-${i % 6} h-full`} style={{ width: `${Math.min(100, (c.weight / Math.max(100, weightSum)) * 100)}%` }} />
                  ))}
                </div>
                <ul className="mb-3 space-y-2">
                  {categories.map((c, i) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <span className={`sw-${i % 6} mt-3 h-2.5 w-2.5 shrink-0 rounded-full`} />
                      <div className="min-w-0 flex-1"><CategoryRowForm id={c.id} name={c.name} weight={c.weight} /></div>
                      <ConfirmButton action={deleteCategoryAction} name="categoryId" value={c.id} message={t("gr.deleteCategoryConfirm")} label={t("gr.delete")} />
                    </li>
                  ))}
                </ul>
                <p className={`mb-4 text-xs ${weightsOk ? "text-success" : "text-warning"}`} data-testid="weight-sum">
                  {t("gr.weightSum", { n: Math.round(weightSum * 100) / 100 })}
                  {!weightsOk && <> — {t("gr.weightWarn")}</>}
                </p>
              </>
            )}
            <AddCategoryForm offeringId={offering.id} />
          </Step>

          <Step n={2} title={t("gr.items")} hint={t("gr.itemsHint")} testId="setup-items">
            {items.length > 0 && (
              <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
                {items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{i.title}</div>
                      <div className="text-xs text-subtle">
                        {t("gr.outOf", { max: formatPoints(i.maxPoints) })} · {i.categoryId ? catName.get(i.categoryId) : t("gr.noCategory")}
                        {i.assignment && <> · {t("gr.linked")}</>}
                      </div>
                    </div>
                    <form action={toggleItemReleaseAction}>
                      <input type="hidden" name="itemId" value={i.id} />
                      <button
                        className={`badge cursor-pointer ${i.isReleased ? "bg-emerald-500/10 text-success" : "bg-surface-3 text-muted"}`}
                        title={t(i.isReleased ? "gr.hide" : "gr.release")}
                      >
                        {t(i.isReleased ? "gr.released" : "gr.hidden")} ⇄
                      </button>
                    </form>
                    <ConfirmButton action={deleteItemAction} name="itemId" value={i.id} message={t("gr.deleteItemConfirm")} label={t("gr.delete")} />
                  </li>
                ))}
              </ul>
            )}
            <AddItemForm offeringId={offering.id} categories={cats} />
          </Step>

          <Step n={3} title={t("gr.scale")} hint={t("gr.scaleHint")} testId="setup-scale">
            <ScaleForm offeringId={offering.id} scale={scale} />
            <form action={toggleShowTotalAction} className="mt-5 border-t border-border pt-4">
              <input type="hidden" name="offeringId" value={offering.id} />
              <button className="flex items-center gap-2 text-left text-sm text-muted hover:text-fg">
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${offering.showTotalToStudents ? "border-accent bg-accent text-accent-fg" : "border-border-strong"}`}>
                  {offering.showTotalToStudents && "✓"}
                </span>
                {t("gr.showTotal")}
              </button>
            </form>
          </Step>

          <div className="flex justify-end">
            <Link href={`${base}?view=scores`} className="btn">{t("gr.toScores")} →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
