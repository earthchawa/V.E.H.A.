"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { forgotPasswordAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  const { t } = useI18n();
  if (state?.success) return <FormMessage state={state} />;
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">{t("login.id")}</label>
        <input id="username" name="username" className="input" required autoFocus />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">{t("forgot.submit")}</SubmitButton>
    </KeepForm>
  );
}
