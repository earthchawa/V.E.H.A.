import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { CreateUserForm, ImportUsersForm, ManageUserForm, PromoteForm } from "./forms";
import { YEAR_LEVELS } from "@/lib/year-level";
import { currentAcademicYear } from "@/lib/year-level-server";
import { Modal } from "@/components/Modal";
import { deptColor } from "@/lib/departments";

/** Bulk imports run as server actions from this page: hashing dozens of passwords takes ~15 s, so allow 60 s on Vercel. */
export const maxDuration = 60;

export async function generateMetadata() {
  return { title: (await getI18n()).t("users.title") };
}

/** Tabs, in the order an admin most often needs them. */
const TABS = [
  { role: "STUDENT", key: "users.tab.cadets" },
  { role: "INSTRUCTOR", key: "users.tab.instructors" },
  { role: "ADMIN", key: "users.tab.admins" },
] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; dept?: string; year?: string }> }) {
  const me = await requireRole("ADMIN");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const dept = sp.dept ?? "";
  const role = TABS.some((x) => x.role === sp.role) ? (sp.role as Role) : null;
  const { t, date, role: roleLabel, lang } = await getI18n();
  const academicYear = await currentAcademicYear();
  // "3" = that year level this academic year; "none" = cadets without one.
  const year = sp.year === "none" || YEAR_LEVELS.includes(Number(sp.year)) ? sp.year! : "";

  const departments = await db.department.findMany({
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { position: "asc" }, { code: "asc" }],
    include: { parent: true },
  });
  const name = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const deptOptions = departments.map((d) => ({ code: d.code, label: `${d.parent ? "— " : ""}${d.code} ${name(d)}` }));

  const filter: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }] } : {}),
    ...(dept === "none" ? { departmentId: null } : dept ? { departmentId: dept } : {}),
    ...(year === "none"
      ? { role: "STUDENT" as const, cadetYears: { none: { academicYear } } }
      : year
        ? { cadetYears: { some: { academicYear, yearLevel: Number(year) } } }
        : {}),
  };
  const [users, counts] = await Promise.all([
    db.user.findMany({
      where: { ...filter, ...(role ? { role } : {}) },
      orderBy: [{ role: "asc" }, { username: "asc" }],
      take: 1000,
      include: { department: { include: { parent: true } }, cadetYears: { orderBy: { academicYear: "asc" }, select: { academicYear: true, yearLevel: true } } },
    }),
    db.user.groupBy({ by: ["role"], where: filter, _count: { _all: true } }),
  ]);
  const countOf = (r: Role | null) => counts.filter((c) => !r || c.role === r).reduce((n, c) => n + c._count._all, 0);

  // Group by department (in the departments' own order), people without one last.
  const order = new Map(departments.map((d, i) => [d.id, i]));
  const groups = new Map<string, typeof users>();
  for (const u of users) {
    const k = u.departmentId ?? "";
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => (a ? order.get(a) ?? 0 : 1e9) - (b ? order.get(b) ?? 0 : 1e9));

  // For the promotion dialog: cadets per year level in each academic year on record.
  const yearCounts = await db.cadetYear.groupBy({ by: ["academicYear", "yearLevel"], where: { user: { role: "STUDENT", isActive: true } }, _count: { _all: true } });
  const promoCounts: Record<number, Record<number, number>> = {};
  for (const r of yearCounts) (promoCounts[r.academicYear] ??= {})[r.yearLevel] = r._count._all;
  const promoYears = Object.keys(promoCounts).map(Number).sort((a, b) => b - a);
  const levelOf = (u: (typeof users)[number]) => u.cadetYears.find((y) => y.academicYear === academicYear)?.yearLevel ?? null;
  const showYear = role !== "INSTRUCTOR" && role !== "ADMIN";

  const now = new Date();
  const statusOf = (u: (typeof users)[number]) =>
    !u.isActive
      ? { text: t("status.disabled"), cls: "bg-surface-3 text-muted" }
      : u.lockedUntil && u.lockedUntil > now
        ? { text: t("status.locked"), cls: "bg-red-500/10 text-danger" }
        : u.mustChangePassword
          ? u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < now
            ? { text: t("status.tempExpired"), cls: "bg-red-500/10 text-danger" }
            : { text: t("status.pending"), cls: "bg-amber-500/10 text-warning" }
          : { text: t("status.active"), cls: "bg-emerald-500/10 text-success" };

  const tabHref = (r: string | null) => {
    const p = new URLSearchParams();
    if (r) p.set("role", r);
    if (q) p.set("q", q);
    if (dept) p.set("dept", dept);
    if (year && (!r || r === "STUDENT")) p.set("year", year);
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };
  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`;

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        help={t("users.desc")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Modal label={`+ ${t("users.new")}`} title={t("users.new")} testId="new-user">
              <CreateUserForm departments={deptOptions} academicYear={academicYear} />
            </Modal>
            <Modal label={t("users.import")} title={t("users.import")} buttonClassName="btn-secondary h-9" size="lg" testId="import-users">
              <ImportUsersForm />
            </Modal>
            {promoYears.length > 0 && (
              <Modal label={<><span aria-hidden>⇧</span> {t("promo.title")}</>} title={t("promo.title")} buttonClassName="btn-secondary h-9" size="lg" testId="promote">
                <PromoteForm years={promoYears} counts={promoCounts} />
              </Modal>
            )}
          </div>
        }
      />

      <nav className="mb-3 flex flex-wrap gap-1" data-testid="user-tabs">
        <Link href={tabHref(null)} className={tabCls(!role)}>{t("users.tab.all")} <span className="text-xs text-subtle">{countOf(null)}</span></Link>
        {TABS.map((x) => (
          <Link key={x.role} href={tabHref(x.role)} className={tabCls(role === x.role)} data-role={x.role}>
            {t(x.key)} <span className="text-xs text-subtle">{countOf(x.role)}</span>
          </Link>
        ))}
      </nav>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <FilterBar className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input name="q" defaultValue={q} placeholder={t("users.search")} className="input h-9 min-w-0 flex-1 sm:max-w-xs" aria-label={t("users.search")} />
          <select name="dept" defaultValue={dept} className="input h-9 w-full py-0 sm:w-auto" aria-label={t("dep.field")}>
            <option value="">{t("dep.all")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{`${d.parent ? "— " : ""}${d.code} ${name(d)}`}</option>)}
            <option value="none">{t("dep.unassigned")}</option>
          </select>
          {showYear && (
            <select name="year" defaultValue={year} className="input h-9 w-full py-0 sm:w-auto" aria-label={t("yl.label")} data-testid="year-filter">
              <option value="">{t("yl.all", { year: academicYear })}</option>
              {YEAR_LEVELS.map((n) => <option key={n} value={n}>{t("yl.level", { n })}</option>)}
              <option value="none">{t("yl.none")}</option>
            </select>
          )}
          <span className="ml-auto pr-1 text-xs text-subtle" data-testid="user-count">{t("users.count", { n: users.length })}</span>
        </FilterBar>

        {users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t("users.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-5">{t("login.id")}</th>
                  <th>{t("users.fullName")}</th>
                  {!role && <th>{t("account.role")}</th>}
                  {showYear && <th>{t("yl.label")}</th>}
                  <th>{t("users.status")}</th>
                  <th>{t("users.lastSignIn")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groupKeys.flatMap((k) => {
                  const d = departments.find((x) => x.id === k);
                  const rows = groups.get(k)!;
                  return [
                    <tr key={`g-${k}`} className="bg-surface-2" data-testid="user-group">
                      <td colSpan={(role ? 5 : 6) + (showYear ? 1 : 0)} className="pl-5 text-xs font-semibold text-muted">
                        {d ? (
                          <span className="cc inline-flex items-center gap-2" style={{ ["--cc" as string]: deptColor({ ...d, parent: d.parent }) ?? "var(--color-accent)" }}>
                            <span className="cc-bar h-3 w-1 rounded" />
                            <span className="font-mono">{d.code}</span> {name(d)}
                            {d.parent && <span className="font-normal text-subtle">· {d.parent.code}</span>}
                          </span>
                        ) : (
                          t("dep.unassigned")
                        )}
                        <span className="ml-2 font-normal text-subtle">{rows.length}</span>
                      </td>
                    </tr>,
                    ...rows.map((u) => {
                      const status = statusOf(u);
                      return (
                        <tr key={u.id} data-testid="user-row" data-username={u.username}>
                          <td className="pl-5 font-mono text-xs">{u.username}</td>
                          <td className="min-w-[12rem]">
                            <div>{u.fullName}</div>
                            {u.email && <div className="text-xs text-subtle">{u.email}</div>}
                          </td>
                          {!role && <td className="whitespace-nowrap text-muted">{roleLabel(u.role)}</td>}
                          {showYear && (
                            <td className="whitespace-nowrap" data-testid="user-year">
                              {u.role !== "STUDENT" ? "" : levelOf(u) ? <span className="badge bg-accent/10 text-accent">{t("yl.level", { n: levelOf(u)! })}</span> : <span className="text-subtle">—</span>}
                            </td>
                          )}
                          <td><span className={`badge whitespace-nowrap ${status.cls}`}>{status.text}</span></td>
                          <td className="whitespace-nowrap text-xs text-subtle">{u.lastLoginAt ? date(u.lastLoginAt) : "—"}</td>
                          <td className="pr-5 text-right">
                            <Modal label={t("users.manage")} title={`${u.fullName} · ${u.username}`} buttonClassName="btn-secondary" size="lg" testId="manage-user">
                              <ManageUserForm
                                user={{ id: u.id, username: u.username, fullName: u.fullName, role: u.role, email: u.email, department: u.department?.code ?? null, isActive: u.isActive, yearLevel: levelOf(u), years: u.cadetYears }}
                                departments={deptOptions}
                                isSelf={u.id === me.id}
                                academicYear={academicYear}
                              />
                            </Modal>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
