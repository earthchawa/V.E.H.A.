"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { loginAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { InfoTip } from "@/components/InfoTip";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label flex items-center gap-1.5" htmlFor="username">{t("login.id")} <InfoTip text={t("login.subtitle")} align="start" /></label>
        <input id="username" name="username" className="input" autoComplete="username" placeholder={t("login.idPlaceholder")} required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("login.password")}</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full" pendingText={t("login.pending")}>{t("login.submit")}</SubmitButton>
    </KeepForm>
  );
}
