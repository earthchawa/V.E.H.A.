"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { resetPasswordAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="newPassword">{t("pw.new")}</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1.5 text-xs text-subtle">{t("pw.hintShort")}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">{t("pw.confirm")}</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">{t("reset.submit")}</SubmitButton>
    </KeepForm>
  );
}
