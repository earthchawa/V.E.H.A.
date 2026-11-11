import type { Prisma } from "@prisma/client";

/** Groups of audit actions, by action prefix. Order is the order shown in the UI. */
export const AUDIT_CATEGORIES = {
  auth: ["login.", "password.", "email."],
  users: ["user.", "enrollment."],
  courses: ["term.", "course.", "offering.", "material."],
  assignments: ["assignment.", "submission.", "similarity."],
  quizzes: ["quiz."],
  grades: ["grade."],
  settings: ["department.", "exam.", "audit.", "backup.", "storage."],
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const AUDIT_CATEGORY_KEYS = Object.keys(AUDIT_CATEGORIES) as AuditCategory[];

export function categoryOf(action: string): AuditCategory | null {
  for (const c of AUDIT_CATEGORY_KEYS) if (AUDIT_CATEGORIES[c].some((p) => action.startsWith(p))) return c;
  return null;
}

/** Failed sign-ins and lockouts: shown in red and selectable with "problems only". */
export const isProblem = (action: string) => /failed|locked/.test(action);

export type AuditFilter = {
  category: AuditCategory | null;
  departmentId: string | null;
  q: string;
  from: string; // YYYY-MM-DD, Bangkok
  to: string;
  problems: boolean;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00+07:00`).getTime());

export function parseAuditFilter(sp: Params): AuditFilter {
  const category = one(sp.cat);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    category: (AUDIT_CATEGORY_KEYS as string[]).includes(category) ? (category as AuditCategory) : null,
    departmentId: one(sp.dept) || null,
    q: one(sp.q).trim().slice(0, 100),
    from: isDay(from) ? from : "",
    to: isDay(to) ? to : "",
    problems: one(sp.problems) === "1",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Bangkok calendar day `n` days before `now`, as YYYY-MM-DD. */
export function bangkokDay(now: Date, daysAgo = 0): string {
  return new Date(now.getTime() + 7 * 3600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Prisma filter for the audit log. `departmentIds` is the chosen department plus its subject areas
 * (resolved by the caller, which has the database).
 */
export function auditWhere(f: AuditFilter, departmentIds: string[] | null): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.category) and.push({ OR: AUDIT_CATEGORIES[f.category].map((p) => ({ action: { startsWith: p } })) });
  if (f.problems) and.push({ OR: [{ action: { contains: "failed" } }, { action: { contains: "locked" } }] });
  if (departmentIds) and.push({ departmentId: { in: departmentIds } });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+07:00`) } });
  if (f.to) and.push({ createdAt: { lt: new Date(new Date(`${f.to}T00:00:00+07:00`).getTime() + 86_400_000) } });
  if (f.q) {
    and.push({
      OR: [
        { actor: { username: { contains: f.q, mode: "insensitive" } } },
        { actor: { fullName: { contains: f.q, mode: "insensitive" } } },
        { action: { contains: f.q, mode: "insensitive" } },
        { ip: { startsWith: f.q } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

/** Query string for the same filter with some fields changed (for links and pagination). */
export function auditQuery(f: AuditFilter, change: Partial<AuditFilter> = {}): string {
  const n = { ...f, page: 1, ...change };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.category) p.set("cat", n.category);
  if (n.departmentId) p.set("dept", n.departmentId);
  if (n.from) p.set("from", n.from);
  if (n.to) p.set("to", n.to);
  if (n.problems) p.set("problems", "1");
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
