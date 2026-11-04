"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { changePasswordAction } from "@/app/auth-actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function ChangePasswordForm({ askEmail, currentEmail }: { askEmail?: boolean; currentEmail?: string | null }) {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="currentPassword">{t("pw.current")}</label>
        <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">{t("pw.new")}</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1.5 text-xs text-subtle">{t("pw.hint")}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">{t("pw.confirm")}</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      {askEmail && (
        <div>
          <label className="label" htmlFor="email">{t("pw.recoveryEmail")} <span className="text-subtle">{t("common.optional")}</span></label>
          <input id="email" name="email" type="email" className="input" defaultValue={currentEmail ?? ""} autoComplete="email" />
          <p className="mt-1.5 text-xs text-subtle">{t("pw.recoveryHint")}</p>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">{t("pw.save")}</SubmitButton>
    </KeepForm>
  );
}
