"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { addExamNetworkAction, saveSebKeysAction } from "../actions";
import { InfoTip } from "@/components/InfoTip";

export function AddRoomForm({ yourIp }: { yourIp: string | null }) {
  const [state, action, pending] = useActionState(addExamNetworkAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
      <div>
        <label className="label" htmlFor="room-name">{t("es.roomName")}</label>
        <input id="room-name" name="name" className="input" placeholder="CS Lab 301" required />
      </div>
      <div>
        <label className="label inline-flex items-center gap-1.5" htmlFor="room-cidrs">{t("es.cidrs")} <InfoTip text={t("es.cidrsHint")} align="start" /></label>
        <textarea id="room-cidrs" name="cidrs" rows={3} className="input font-mono text-xs" placeholder="10.20.3.0/24" required />
        {yourIp && <p className="mt-1 text-xs text-subtle">{t("es.yourIp", { ip: yourIp })}</p>}
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("es.addRoom")}</SubmitButton>
    </KeepForm>
  );
}

export function SebKeysForm({ keys }: { keys: string }) {
  const [state, action, pending] = useActionState(saveSebKeysAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-3">
      <label className="label" htmlFor="seb-keys">{t("es.sebKeys")}</label>
      <textarea id="seb-keys" name="keys" rows={3} className="input font-mono text-xs" defaultValue={keys} />
      <p className="text-xs text-subtle">{t("es.sebKeysHint")}</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary">{t("es.save")}</SubmitButton>
    </KeepForm>
  );
}
