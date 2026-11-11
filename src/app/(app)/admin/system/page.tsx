import { requireRole } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { aiAnswersEnabled } from "@/lib/ai-answers";
import { InfoTip } from "@/components/InfoTip";
import { PageHeader } from "@/components/PageHeader";
import { MoveFilesForm } from "./forms";

export const maxDuration = 60;

export async function generateMetadata() {
  return { title: (await getI18n()).t("sys.title") };
}

/** Admin → System: where files are kept, backups to download, and which optional services are switched on. */
export default async function SystemPage() {
  await requireRole("ADMIN");
  const { t, date } = await getI18n();
  const [materials, submissionFiles, inDb, lastBackup, dbSize] = await Promise.all([
    db.material.aggregate({ where: { storageKey: { not: null } }, _count: true, _sum: { sizeBytes: true } }),
    db.submissionFile.aggregate({ _count: true, _sum: { sizeBytes: true } }),
    db.storedFile.aggregate({ _count: true, _sum: { sizeBytes: true } }),
    db.auditLog.findFirst({ where: { action: "backup.downloaded" }, orderBy: { createdAt: "desc" }, include: { actor: { select: { fullName: true } } } }),
    db.$queryRaw<{ size: bigint }[]>`select pg_database_size(current_database()) as size`,
  ]);
  const files = materials._count + submissionFiles._count;
  const bytes = (materials._sum.sizeBytes ?? 0) + (submissionFiles._sum.sizeBytes ?? 0);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
  const on = (yes: boolean) => <span className={`badge ${yes ? "bg-emerald-500/10 text-success" : "bg-surface-3 text-muted"}`}>{t(yes ? "sys.on" : "sys.off")}</span>;

  return (
    <div>
      <PageHeader title={t("sys.title")} help={t("sys.desc")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" data-testid="backup-card">
          <h2 className="card-title flex items-center gap-1.5">{t("sys.backup.title")} <InfoTip text={t("sys.backup.hint")} align="start" /></h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t("sys.backup.db")}</div>
                <div className="text-xs text-muted">{t("sys.backup.dbHint")}</div>
              </div>
              <a href={`/api/admin/backup${inDb._count ? "?files=1" : ""}`} className="btn h-9" data-testid="download-backup">
                <span aria-hidden>⇩</span> {t("sys.backup.download")}
              </a>
            </div>
            {/* Files kept in Postgres travel inside the database backup; other stores get their own archive. */}
            {files - inDb._count > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t("sys.backup.files")}</div>
                  <div className="text-xs text-muted">{t("sys.backup.filesHint", { n: files, size: formatBytes(bytes) })}</div>
                </div>
                <a href="/api/admin/backup/files" className="btn-secondary h-9 px-4 text-sm" data-testid="download-files">
                  <span aria-hidden>⇩</span> {t("sys.backup.download")}
                </a>
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted" data-testid="last-backup">
            {lastBackup ? t("sys.backup.last", { date: date(lastBackup.createdAt), name: lastBackup.actor?.fullName ?? "—" }) : t("sys.backup.never")}
          </p>
          <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-warning">{t("sys.backup.warn")}</p>
        </section>

        <section className="card text-sm" data-testid="storage-card">
          <h2 className="card-title flex items-center gap-1.5">{t("sys.storage.title")} <InfoTip text={t("sys.storage.hint")} align="start" /></h2>
          <dl className="divide-y divide-border">
            {row(t("sys.storage.where"), t(`sys.storage.${config.storageDriver}`))}
            {row(t("sys.storage.max"), `${config.maxUploadMb} MB`)}
            {row(t("sys.storage.files"), `${files} · ${formatBytes(bytes)}`)}
            {row(t("sys.storage.dbSize"), formatBytes(Number(dbSize[0]?.size ?? 0)))}
            {inDb._count > 0 && row(t("sys.storage.inDb"), `${inDb._count} · ${formatBytes(inDb._sum.sizeBytes ?? 0)}`)}
          </dl>
          {config.onVercel && !config.hasBlob && <p className="mt-3 rounded-lg border border-border px-3 py-2 text-xs leading-relaxed text-muted">{t("sys.blob.howto")}</p>}
          {config.hasBlob && inDb._count > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-3 text-xs leading-relaxed text-muted">{t("sys.move.hint", { n: inDb._count })}</p>
              <MoveFilesForm />
            </div>
          )}
        </section>

        <section className="card text-sm lg:col-span-2" data-testid="services-card">
          <h2 className="card-title">{t("sys.services")}</h2>
          <dl className="divide-y divide-border">
            {row(t("sys.svc.blob"), on(config.storageDriver === "blob"))}
            {row(t("sys.svc.ai"), on(aiAnswersEnabled()))}
            {row(t("sys.svc.email"), on(config.emailReset))}
          </dl>
        </section>
      </div>
    </div>
  );
}
