"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { createUserAction, importUsersAction, resetUserPasswordAction } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { IssuedPasswords, type Issued } from "@/components/IssuedPasswords";
import { FileDropzone } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n/client";

export function CreateUserForm({ departments = [] }: { departments?: { code: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cu-username">{t("login.id")}</label>
          <input id="cu-username" name="username" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="cu-role">{t("account.role")}</label>
          <select id="cu-role" name="role" className="input" defaultValue="STUDENT">
            <option value="STUDENT">{t("role.STUDENT")}</option>
            <option value="INSTRUCTOR">{t("role.INSTRUCTOR")}</option>
            <option value="ADMIN">{t("role.ADMIN")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cu-fullName">{t("users.fullName")}</label>
        <input id="cu-fullName" name="fullName" className="input" required />
      </div>
      {departments.length > 0 && (
        <div>
          <label className="label" htmlFor="cu-dept">{t("dep.field")} <span className="text-subtle">{t("common.optional")}</span></label>
          <select id="cu-dept" name="department" className="input" defaultValue="">
            <option value="">{t("dep.unassigned")}</option>
            {departments.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="cu-email">{t("users.email")} <span className="text-subtle">{t("common.optional")}</span></label>
        <input id="cu-email" name="email" type="email" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("users.create")}</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </KeepForm>
  );
}

export function ImportUsersForm() {
  const [state, action, pending] = useActionState(importUsersAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">{t("users.importHelp")}</p>
      <FileDropzone id="csv-file" name="file" accept=".csv,text/csv" />
      <textarea
        name="csv"
        rows={4}
        className="input font-mono text-xs"
        aria-label="CSV rows"
        placeholder={t("users.pastePlaceholder")}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText={t("users.importing")}>{t("users.importBtn")}</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </KeepForm>
  );
}

export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const [state, action] = useActionState(resetUserPasswordAction, undefined);
  const issued = (state?.data as Issued[] | undefined)?.[0];
  const { t } = useI18n();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("users.resetConfirm", { id: username })))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      {issued ? (
        <span className="badge bg-amber-500/10 px-2 py-1 font-mono text-sm text-warning" title={t("temp.shownOnce")}>
          {issued.password}
        </span>
      ) : (
        <SubmitButton className="btn-secondary" pendingText="…">{t("users.reset")}</SubmitButton>
      )}
    </form>
  );
}
