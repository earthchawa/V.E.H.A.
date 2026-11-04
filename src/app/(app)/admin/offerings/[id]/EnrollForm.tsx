"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { enrollAction } from "../../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function EnrollForm({ offeringId }: { offeringId: string }) {
  const [state, action, pending] = useActionState(enrollAction.bind(null, offeringId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-4">
      <div>
        <label className="label" htmlFor="role">{t("roster.addAs")}</label>
        <select id="role" name="role" className="input">
          <option value="STUDENT">{t("role.STUDENT")}</option>
          <option value="INSTRUCTOR">{t("role.INSTRUCTOR")}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="usernames">{t("roster.ids")} <span className="text-subtle">{t("roster.idsHint")}</span></label>
        <textarea id="usernames" name="usernames" rows={6} className="input font-mono text-xs" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("roster.submit")}</SubmitButton>
    </KeepForm>
  );
}
