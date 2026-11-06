import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { en } from "@/lib/i18n/en";
import type { Key } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { deptColor } from "@/lib/departments";
import {
  AUDIT_CATEGORY_KEYS,
  auditQuery,
  auditWhere,
  bangkokDay,
  categoryOf,
  isProblem,
  parseAuditFilter,
  type AuditCategory,
} from "@/lib/audit-filter";
import { departmentScope, loadAuditLogs } from "@/lib/audit-query";
import { InfoTip } from "@/components/InfoTip";

export async function generateMetadata() {
  return { title: (await getI18n()).t("act.title") };
}

const PAGE_SIZE = 100;

/** Badge colours per category (backgrounds only; text uses the readable --cc-fg mix). */
const CAT_COLOR: Record<AuditCategory, string> = {
  auth: "#5b8cff",
  users: "#a78bfa",
  courses: "#22d3ee",
  assignments: "#34d399",
  quizzes: "#f59e0b",
  grades: "#f472b6",
  settings: "#9ca3af",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, lang, date } = await getI18n();
  const f = parseAuditFilter(await searchParams);
  const now = new Date();

  const departments = await db.department.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, nameTh: true, parentId: true, color: true, logoUrl: true, logoKey: true },
  });
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const label = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const tops = departments.filter((d) => !d.parentId);

  const { logs, total, courseOf } = await loadAuditLogs(f, { take: PAGE_SIZE, skip: (f.page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Counts per category for the other filters (so the chips show where the activity is).
  const grouped = await db.auditLog.groupBy({
    by: ["action"],
    where: auditWhere({ ...f, category: null }, await departmentScope(f.departmentId)),
    _count: { _all: true },
  });
  const catCount = new Map<AuditCategory | "all", number>([["all", 0]]);
  for (const g of grouped) {
    const c = categoryOf(g.action);
    catCount.set("all", (catCount.get("all") ?? 0) + g._count._all);
    if (c) catCount.set(c, (catCount.get(c) ?? 0) + g._count._all);
  }

  const actionLabel = (a: string) => (`log.${a}` in en ? t(`log.${a}` as Key) : a);
  const dayFmt = new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
  const dayKey = (d: Date) => bangkokDay(d);

  const ranges = [
    { key: "act.f.today" as const, from: bangkokDay(now), to: "" },
    { key: "act.f.7d" as const, from: bangkokDay(now, 6), to: "" },
    { key: "act.f.30d" as const, from: bangkokDay(now, 29), to: "" },
  ];
  const chip = (active: boolean) =>
    `inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition ${
      active ? "border-accent/50 bg-accent/15 text-fg" : "border-border text-muted hover:bg-surface-3 hover:text-fg"
    }`;

  let lastDay = "";
  return (
    <div>
      <PageHeader
        title={t("act.title")}
        help={t("act.desc")}
        actions={
          <a href={`/api/admin/audit${auditQuery(f)}`} className="btn-secondary" data-testid="audit-export">
            {t("act.f.export")}
          </a>
        }
      />

      {/* Category chips */}
      <nav className="mb-4 flex flex-wrap gap-2" data-testid="audit-categories">
        <Link href={`/admin/audit${auditQuery(f, { category: null })}`} className={chip(!f.category)}>
          {t("act.all")} <span className="text-subtle">{catCount.get("all") ?? 0}</span>
        </Link>
        {AUDIT_CATEGORY_KEYS.map((c) => (
          <Link key={c} href={`/admin/audit${auditQuery(f, { category: c })}`} className={chip(f.category === c)} data-cat={c}>
            <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] }} />
            {t(`act.cat.${c}` as Key)} <span className="text-subtle">{catCount.get(c) ?? 0}</span>
          </Link>
        ))}
      </nav>

      {/* Filters (plain GET form: the URL is shareable and the back button works) */}
      <form method="get" className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_auto]" data-testid="audit-filters">
        {f.category && <input type="hidden" name="cat" value={f.category} />}
        <div>
          <label className="label" htmlFor="audit-q">{t("act.f.search")}</label>
          <input id="audit-q" name="q" className="input" defaultValue={f.q} />
        </div>
        <div>
          <label className="label" htmlFor="audit-dept">{t("act.f.dept")}</label>
          <select id="audit-dept" name="dept" className="input" defaultValue={f.departmentId ?? ""}>
            <option value="">{t("act.f.allDepts")}</option>
            {tops.map((d) => {
              const kids = departments.filter((x) => x.parentId === d.id);
              return [
                <option key={d.id} value={d.id}>{`${d.code} — ${label(d)}`}</option>,
                ...kids.map((k) => <option key={k.id} value={k.id}>{`   ${k.code} — ${label(k)}`}</option>),
              ];
            })}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="audit-from">{t("act.f.from")}</label>
          <input id="audit-from" type="date" name="from" className="input" defaultValue={f.from} />
        </div>
        <div>
          <label className="label" htmlFor="audit-to">{t("act.f.to")}</label>
          <input id="audit-to" type="date" name="to" className="input" defaultValue={f.to} />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn" type="submit">{t("act.f.apply")}</button>
          <Link href="/admin/audit" className="btn-secondary h-9">{t("act.f.clear")}</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
          {ranges.map((r) => (
            <Link key={r.key} href={`/admin/audit${auditQuery(f, { from: r.from, to: r.to })}`} className={chip(f.from === r.from && !f.to)}>
              {t(r.key)}
            </Link>
          ))}
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="problems" value="1" defaultChecked={f.problems} />
            {t("act.f.problems")}
          </label>
        </div>
      </form>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span data-testid="audit-count">{t("act.count", { n: total.toLocaleString() })}</span>
        <InfoTip text={t("act.deptNote")} align="end" />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{t("act.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table" data-testid="audit-table">
              <thead>
                <tr>
                  <th className="pl-5">{t("act.time")}</th>
                  <th>{t("act.action")}</th>
                  <th>{t("act.user")}</th>
                  <th>{t("act.course")}</th>
                  <th>{t("act.details")}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.flatMap((l) => {
                  const rows = [];
                  const dk = dayKey(l.createdAt);
                  if (dk !== lastDay) {
                    lastDay = dk;
                    rows.push(
                      <tr key={`day-${dk}`} className="bg-surface-2">
                        <td colSpan={6} className="pl-5 text-xs font-semibold text-muted" data-testid="audit-day">
                          {dayFmt.format(l.createdAt)}
                        </td>
                      </tr>,
                    );
                  }
                  const cat = categoryOf(l.action);
                  const dept = l.departmentId ? deptById.get(l.departmentId) : undefined;
                  const parent = dept?.parentId ? deptById.get(dept.parentId) : null;
                  const course = l.offeringId ? courseOf.get(l.offeringId) : undefined;
                  const details = [l.targetType && `${l.targetType}:${l.targetId}`, l.details && JSON.stringify(l.details)].filter(Boolean).join(" ");
                  rows.push(
                    <tr key={l.id} data-action={l.action}>
                      <td className="whitespace-nowrap pl-5 font-mono text-xs text-muted" title={date(l.createdAt)}>{timeFmt.format(l.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        {/* Category as a coloured dot (named in the chips above and on hover), so the action fits on one line. */}
                        <span className="inline-flex items-center gap-2" title={cat ? t(`act.cat.${cat}` as Key) : undefined}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat ? CAT_COLOR[cat] : "var(--color-subtle)" }} />
                          <span className={isProblem(l.action) ? "font-medium text-danger" : "text-fg"}>{actionLabel(l.action)}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap leading-tight">
                        {l.actor ? (
                          <>
                            <div>{l.actor.fullName}</div>
                            <div className="font-mono text-xs text-subtle">{l.actor.username}</div>
                          </>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {course && <span className="font-mono">{course.code}</span>}
                        {course && course.section !== "1" && <span className="text-subtle"> · {course.section}</span>}
                        {dept && (
                          <span
                            className="cc cc-tint badge ml-1.5"
                            style={{ ["--cc" as string]: deptColor({ ...dept, parent }) ?? "var(--color-accent)" }}
                            title={label(dept)}
                          >
                            {dept.code}
                          </span>
                        )}
                      </td>
                      <td className="max-w-sm font-mono text-xs text-subtle">
                        {details.length > 80 ? (
                          <details>
                            <summary className="cursor-pointer truncate">{details.slice(0, 80)}…</summary>
                            <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(l.details, null, 2)}</pre>
                          </details>
                        ) : (
                          details
                        )}
                      </td>
                      <td className="text-xs text-subtle">{l.ip ?? ""}</td>
                    </tr>,
                  );
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted" data-testid="audit-pager">
          {f.page > 1 ? <Link className="btn-secondary" href={`/admin/audit${auditQuery(f, { page: f.page - 1 })}`}>← {t("act.prev")}</Link> : <span />}
          <span>{t("act.page", { page: f.page, pages })}</span>
          {f.page < pages ? <Link className="btn-secondary" href={`/admin/audit${auditQuery(f, { page: f.page + 1 })}`}>{t("act.next")} →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
