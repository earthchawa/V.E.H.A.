import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";

export async function generateMetadata() {
  return { title: (await getI18n()).t("act.title") };
}

export default async function AuditPage() {
  const { t, date } = await getI18n();
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { username: true, fullName: true } } },
  });
  return (
    <div>
      <PageHeader title={t("act.title")} description={t("act.desc")} />
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th className="pl-5">{t("act.time")}</th><th>{t("act.user")}</th><th>{t("act.action")}</th><th>{t("act.details")}</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap pl-5 text-xs text-muted">{date(l.createdAt)}</td>
                  <td>{l.actor ? <><span className="font-mono text-xs text-subtle">{l.actor.username}</span> {l.actor.fullName}</> : <span className="text-subtle">—</span>}</td>
                  <td className={`font-mono text-xs ${/failed|locked/.test(l.action) ? "text-danger" : "text-fg"}`}>{l.action}</td>
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
