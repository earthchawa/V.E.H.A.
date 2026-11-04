"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { saveDepartmentAction } from "../actions";

export function DepartmentForm({
  id = null,
  defaults = { code: "", name: "", nameTh: "", parentId: "" },
  divisions,
}: {
  id?: string | null;
  defaults?: { code: string; name: string; nameTh: string; parentId: string };
  divisions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveDepartmentAction.bind(null, id), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
      <div>
        <label className="label" htmlFor="dep-parent">{t("dep.parent")}</label>
        <select id="dep-parent" name="parentId" className="input" defaultValue={defaults.parentId}>
          <option value="">{t("dep.isDivision")}</option>
          {divisions.filter((d) => d.id !== id).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <div>
          <label className="label" htmlFor="dep-code">{t("dep.code")}</label>
          <input id="dep-code" name="code" className="input font-mono uppercase" defaultValue={defaults.code} placeholder="CS" required />
        </div>
        <div>
          <label className="label" htmlFor="dep-name">{t("dep.name")}</label>
          <input id="dep-name" name="name" className="input" defaultValue={defaults.name} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="dep-nameTh">{t("dep.nameTh")}</label>
        <input id="dep-nameTh" name="nameTh" className="input" defaultValue={defaults.nameTh} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("es.save")}</SubmitButton>
    </KeepForm>
  );
}
