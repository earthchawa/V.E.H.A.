import { config } from "@/lib/config";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requestMeta } from "@/lib/request";
import { SETTING, getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { ConfirmButton } from "@/app/(app)/courses/[id]/grades/ConfirmButton";
import { deleteExamNetworkAction } from "../actions";
import { AddRoomForm, SebKeysForm } from "./forms";

export async function generateMetadata() {
  return { title: (await getI18n()).t("es.title") };
}

export default async function ExamSettingsPage() {
  const { t } = await getI18n();
  const [rooms, keys, { ip }] = await Promise.all([
    db.examNetwork.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { quizzes: true } } } }),
    getSetting(SETTING.sebConfigKeys),
    requestMeta(),
  ]);
  const h = await headers();
  const startUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}/`;

  return (
    <div>
      <PageHeader title={t("es.title")} description={t("es.desc")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t("es.rooms")}</h2>
            <Modal label={`+ ${t("es.addRoom")}`} title={t("es.addRoom")} buttonClassName="btn-secondary h-8" testId="add-room">
              <AddRoomForm yourIp={ip} />
            </Modal>
          </div>
          <p className="-mt-2 mb-4 text-xs text-muted">{t("es.roomsHint")}</p>
          {rooms.length === 0 ? (
            <p className="text-sm text-subtle">{t("es.noRooms")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5" data-testid="room">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="font-mono text-xs text-subtle">{r.cidrs.split("\n").join(" · ")}</div>
                  </div>
                  <ConfirmButton action={deleteExamNetworkAction} name="networkId" value={r.id} message={t("es.deleteRoomConfirm")} label={t("qz.delete")} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {config.sebEnabled && <section className="card space-y-4">
          <h2 className="text-sm font-semibold">{t("es.seb")}</h2>
          <p className="text-xs leading-relaxed text-muted">{t("es.sebSteps")}</p>
          <div>
            <span className="label">{t("es.startUrl")}</span>
            <code className="block select-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">{startUrl}</code>
          </div>
          <SebKeysForm keys={keys} />
        </section>}
        {!config.sebEnabled && (
          <section className="card space-y-2" data-testid="exam-mode-note">
            <h2 className="text-sm font-semibold">{t("es.modeTitle")}</h2>
            <p className="text-xs leading-relaxed text-muted">{t("es.modeNote")}</p>
          </section>
        )}
      </div>
    </div>
  );
}
