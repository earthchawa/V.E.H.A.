import { db } from "./db";
import { auditWhere, type AuditFilter } from "./audit-filter";

/** Chosen department plus its subject areas, or null for "all departments". */
export async function departmentScope(departmentId: string | null): Promise<string[] | null> {
  if (!departmentId) return null;
  const children = await db.department.findMany({ where: { parentId: departmentId }, select: { id: true } });
  return [departmentId, ...children.map((c) => c.id)];
}

/** One page of audit entries (or all up to `take` for export), with course and department labels. */
export async function loadAuditLogs(f: AuditFilter, opts: { take: number; skip?: number }) {
  const where = auditWhere(f, await departmentScope(f.departmentId));
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.take,
      skip: opts.skip ?? 0,
      include: { actor: { select: { username: true, fullName: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  const offeringIds = [...new Set(logs.map((l) => l.offeringId).filter((x): x is string => !!x))];
  const offerings = offeringIds.length
    ? await db.courseOffering.findMany({ where: { id: { in: offeringIds } }, select: { id: true, section: true, course: { select: { code: true } } } })
    : [];
  const courseOf = new Map(offerings.map((o) => [o.id, { code: o.course.code, section: o.section }]));
  return { logs, total, courseOf, where };
}
