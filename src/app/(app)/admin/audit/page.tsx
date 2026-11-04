import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Activity" };

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { username: true, fullName: true } } },
  });
  return (
    <div>
      <PageHeader title="Activity" description="Last 200 sign-ins, password events and admin changes." />
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th className="pl-5">Time</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap pl-5 text-xs text-muted">{formatDateTime(l.createdAt)}</td>
                  <td>{l.actor ? <><span className="font-mono text-xs text-subtle">{l.actor.username}</span> {l.actor.fullName}</> : <span className="text-subtle">—</span>}</td>
                  <td className={`font-mono text-xs ${/failed|locked/.test(l.action) ? "text-red-300" : "text-fg"}`}>{l.action}</td>
                  <td className="max-w-md truncate font-mono text-xs text-subtle">
                    {[l.targetType && `${l.targetType}:${l.targetId}`, l.details && JSON.stringify(l.details)].filter(Boolean).join(" ")}
                  </td>
                  <td className="text-xs text-subtle">{l.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
