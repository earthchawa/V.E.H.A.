import Link from "next/link";
import type { Department, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { deptColor } from "@/lib/departments";
import { YEAR_LEVELS } from "@/lib/year-level";

type Dept = Department & { parent: Department | null };

const href = (p: Record<string, string>) => `/admin/users?${new URLSearchParams(p)}`;

/**
 * Users page overview: cadets by year level and by department (each card lists its year levels), and
 * instructors per department (กองวิชา, with its subject areas). Every number links to that slice of the list.
 */
export async function UsersOverview({ role, academicYear, departments, lang }: { role: Role | null; academicYear: number; departments: Dept[]; lang: string }) {
  const { t } = await getI18n();
  const showCadets = role !== "INSTRUCTOR";
  const [cadets, staff] = await Promise.all([
    showCadets
      ? db.user.findMany({
          where: { role: "STUDENT" },
          select: { departmentId: true, cadetYears: { where: { academicYear }, select: { yearLevel: true } } },
        })
      : Promise.resolve([]),
    db.user.groupBy({ by: ["departmentId"], where: { role: "INSTRUCTOR" }, _count: { _all: true } }),
  ]);
  const staffOf = (id: string) => staff.find((s) => (s.departmentId ?? "") === id)?._count._all ?? 0;
  const name = (d: Dept) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const yearKey = (n: number | undefined) => (n ? String(n) : "none");

  // department id ("" = none) → year key → count
  const grid = new Map<string, Map<string, number>>();
  const perYear = new Map<string, number>();
  for (const c of cadets) {
    const y = yearKey(c.cadetYears[0]?.yearLevel);
    const row = grid.get(c.departmentId ?? "") ?? new Map<string, number>();
    row.set(y, (row.get(y) ?? 0) + 1);
    grid.set(c.departmentId ?? "", row);
    perYear.set(y, (perYear.get(y) ?? 0) + 1);
  }
  const yearKeys = [...YEAR_LEVELS.map(String), "none"];
  const yearLabel = (k: string) => (k === "none" ? t("yl.none") : t("yl.level", { n: Number(k) }));
  const deptKeys = [...departments.map((d) => d.id), ""];
  const sum = (m?: Map<string, number>) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);

  const Card = ({ id, total, children, testId, dim = false }: { id: string; total: number; children?: React.ReactNode; testId: string; dim?: boolean }) => {
    const d = departments.find((x) => x.id === id);
    const listRole = testId === "staff-dept" ? "INSTRUCTOR" : "STUDENT";
    return (
      <li
        className={`cc relative rounded-xl border border-border bg-surface-2 p-3 transition hover:border-border-strong ${dim ? "opacity-60" : ""}`}
        style={{ ["--cc" as string]: (d && deptColor({ ...d, parent: d.parent })) ?? "var(--color-muted)" }}
        data-testid={testId}
      >
        <div className="flex items-start gap-2">
          <span className="cc-bar mt-0.5 h-4 w-1 shrink-0 rounded" />
          <Link
            href={href({ role: listRole, dept: id || "none" })}
            className="min-w-0 flex-1 text-sm font-medium after:absolute after:inset-0 hover:underline"
          >
            {d ? <><span className="font-mono">{d.code}</span> {name(d)}</> : t("dep.unassigned")}
            {d?.parent && <span className="ml-1 text-xs font-normal text-subtle">· {d.parent.code}</span>}
          </Link>
          <span className="shrink-0 text-sm tabular-nums text-muted">{total}</span>
        </div>
        {children}
      </li>
    );
  };

  return (
    <div className="space-y-6 p-4">
      {showCadets && (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">{t("users.ov.byYear", { year: academicYear })}</h2>
        <ul className="flex flex-wrap gap-2" data-testid="year-chips">
          {yearKeys.filter((k) => perYear.get(k)).map((k) => (
            <li key={k}>
              <Link href={href({ role: "STUDENT", year: k })} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm hover:border-border-strong">
                {yearLabel(k)} <span className="tabular-nums text-subtle">{perYear.get(k)}</span>
              </Link>
            </li>
          ))}
          {!cadets.length && <li className="text-sm text-muted">{t("users.none")}</li>}
        </ul>
      </section>
      )}

      {cadets.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">{t("users.ov.byDept")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {deptKeys.filter((id) => grid.has(id)).map((id) => {
              const row = grid.get(id)!;
              return (
                <Card key={id || "none"} id={id} total={sum(row)} testId="cadet-dept">
                  <div className="relative z-[1] mt-2 flex flex-wrap gap-1.5 pl-3">
                    {yearKeys.filter((k) => row.get(k)).map((k) => (
                      <Link
                        key={k}
                        href={href({ role: "STUDENT", dept: id || "none", year: k })}
                        className="badge cc-tint gap-1 px-2 py-0.5 text-xs hover:underline"
                        data-testid="dept-year"
                      >
                        {yearLabel(k)} <span className="tabular-nums opacity-70">{row.get(k)}</span>
                      </Link>
                    ))}
                  </div>
                </Card>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">{t("users.ov.staff")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...departments.filter((d) => !d.parentId).map((d) => d.id), ...(staffOf("") ? [""] : [])].map((id) => {
            // A department (กองวิชา) counts its own instructors and those of its subject areas (ภาควิชา).
            const areas = departments.filter((d) => id && d.parentId === id);
            const total = staffOf(id) + areas.reduce((n, a) => n + staffOf(a.id), 0);
            return (
              <Card key={id || "none"} id={id} total={total} testId="staff-dept" dim={total === 0}>
                {areas.some((a) => staffOf(a.id)) && (
                  <div className="relative z-[1] mt-2 flex flex-wrap gap-1.5 pl-3">
                    {areas.filter((a) => staffOf(a.id)).map((a) => (
                      <Link
                        key={a.id}
                        href={href({ role: "INSTRUCTOR", dept: a.id })}
                        className="badge cc-tint gap-1 px-2 py-0.5 text-xs hover:underline"
                        data-testid="dept-area"
                      >
                        <span className="font-mono">{a.code}</span> {name({ ...a, parent: null })}{" "}
                        <span className="tabular-nums opacity-70">{staffOf(a.id)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
