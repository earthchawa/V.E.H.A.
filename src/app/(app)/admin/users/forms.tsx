"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { createUserAction, importUsersAction, resetUserPasswordAction, toggleUserActiveAction, updateUserAction } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { IssuedPasswords, type Issued } from "@/components/IssuedPasswords";
import { FileDropzone } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n/client";
import { InfoTip } from "@/components/InfoTip";

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

export type ManagedUser = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "INSTRUCTOR" | "STUDENT";
  email: string | null;
  department: string | null;
  isActive: boolean;
};

/** Everything about one account in one place: details, then password reset and disabling. */
export function ManageUserForm({ user, departments, isSelf }: { user: ManagedUser; departments: { code: string; label: string }[]; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateUserAction.bind(null, user.id), undefined);
  const { t } = useI18n();
  const id = (f: string) => `mu-${user.id}-${f}`;
  return (
    <div className="space-y-6">
      {/* Close on success: a renamed user moves in the sorted list, and the row (with this dialog) moves with it. */}
      <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label inline-flex items-center gap-1.5" htmlFor={id("username")}>{t("login.id")} <InfoTip text={t("users.usernameHint")} align="start" /></label>
            <input id={id("username")} name="username" className="input font-mono" defaultValue={user.username} required />
          </div>
          <div>
            <label className="label" htmlFor={id("role")}>{t("account.role")}</label>
            <select id={id("role")} name="role" className="input" defaultValue={user.role} disabled={isSelf}>
              <option value="STUDENT">{t("role.STUDENT")}</option>
              <option value="INSTRUCTOR">{t("role.INSTRUCTOR")}</option>
              <option value="ADMIN">{t("role.ADMIN")}</option>
            </select>
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </div>
        </div>
        <div>
          <label className="label inline-flex items-center gap-1.5" htmlFor={id("fullName")}>{t("users.fullName")} <InfoTip text={t("users.fullNameHint")} align="start" /></label>
          <input id={id("fullName")} name="fullName" className="input" defaultValue={user.fullName} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={id("dept")}>{t("dep.field")}</label>
            <select id={id("dept")} name="department" className="input" defaultValue={user.department ?? ""}>
              <option value="">{t("dep.unassigned")}</option>
              {departments.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={id("email")}>{t("users.email")} <span className="text-subtle">{t("common.optional")}</span></label>
            <input id={id("email")} name="email" type="email" className="input" defaultValue={user.email ?? ""} />
          </div>
        </div>
        <FormMessage state={state} />
        <SubmitButton>{t("users.saveChanges")}</SubmitButton>
      </KeepForm>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">{t("users.accountActions")} <InfoTip text={t(user.isActive ? "users.disableHint" : "users.enableHint")} align="start" /></h3>
        <div className="flex flex-wrap items-center gap-3">
          <ResetPasswordButton userId={user.id} username={user.username} />
          {!isSelf && (
            <form
              action={toggleUserActiveAction}
              onSubmit={(e) => {
                if (user.isActive && !confirm(t("users.disableConfirm", { id: user.username }))) e.preventDefault();
              }}
            >
              <input type="hidden" name="userId" value={user.id} />
              <button className={user.isActive ? "btn-danger" : "btn-secondary"}>{t(user.isActive ? "users.disable" : "users.enable")}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
