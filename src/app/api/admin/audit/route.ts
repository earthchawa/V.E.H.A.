import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { parseAuditFilter } from "@/lib/audit-filter";
import { loadAuditLogs } from "@/lib/audit-query";
import { audit } from "@/lib/audit";

const MAX_ROWS = 20_000;

/** Activity log export for admins, with the same filters as the page (UTF-8 with BOM for Excel). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || user.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const f = parseAuditFilter(Object.fromEntries(new URL(req.url).searchParams));
  const { logs, courseOf } = await loadAuditLogs(f, { take: MAX_ROWS });
  const depts = new Map((await db.department.findMany({ select: { id: true, code: true } })).map((d) => [d.id, d.code]));
  const bangkok = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  const rows = [
    ["time (Asia/Bangkok)", "action", "username", "fullName", "course", "section", "department", "target", "details", "ip"],
    ...logs.map((l) => {
      const c = l.offeringId ? courseOf.get(l.offeringId) : undefined;
      return [
        bangkok(l.createdAt),
        l.action,
        l.actor?.username,
        l.actor?.fullName,
        c?.code,
        c?.section,
        l.departmentId ? depts.get(l.departmentId) : "",
        l.targetType ? `${l.targetType}:${l.targetId}` : "",
        l.details ? JSON.stringify(l.details) : "",
        l.ip,
      ];
    }),
  ];
  await audit({ actorId: user.id, action: "audit.exported", details: { rows: logs.length } });
  return new Response("﻿" + toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
