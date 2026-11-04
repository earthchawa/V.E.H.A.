"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { updateEmailAction } from "@/app/auth-actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function UpdateEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, action, pending] = useActionState(updateEmailAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{t("account.emailLabel")}</label>
        <input id="email" name="email" type="email" className="input" defaultValue={currentEmail ?? ""} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="emailPassword">{t("account.emailConfirm")}</label>
        <input id="emailPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary">{t("account.saveEmail")}</SubmitButton>
    </KeepForm>
  );
}
