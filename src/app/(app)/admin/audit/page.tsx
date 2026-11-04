import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "ประวัติการใช้งาน" };

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { username: true, fullName: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ประวัติการใช้งาน (200 รายการล่าสุด)</h1>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                <td>{l.actor ? `${l.actor.username} ${l.actor.fullName}` : "—"}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="max-w-md truncate font-mono text-xs text-slate-500">
                  {[l.targetType && `${l.targetType}:${l.targetId}`, l.details && JSON.stringify(l.details)].filter(Boolean).join(" ")}
                </td>
                <td className="text-xs text-slate-500">{l.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
