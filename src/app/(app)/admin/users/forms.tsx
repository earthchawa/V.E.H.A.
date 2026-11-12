"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { useState } from "react";
import { createUserAction, importUsersChunkAction, promoteCadetsAction, resetUserPasswordAction, toggleUserActiveAction, updateUserAction } from "../actions";
import { DEFAULT_FINAL_YEAR, YEAR_LEVELS } from "@/lib/year-level";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { IssuedPasswords, type Issued } from "@/components/IssuedPasswords";
import { FileDropzone } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n/client";
import { InfoTip } from "@/components/InfoTip";
import { ConfirmForm } from "@/components/ConfirmForm";
import { parseUserImport, toCsv, USER_IMPORT_CHUNK } from "@/lib/csv";
import type { FormState } from "@/lib/form";

/** Year level picker for cadets; `academicYear` tells which year the value is recorded for. */
function YearLevelField({ id, academicYear, defaultValue }: { id: string; academicYear: number; defaultValue?: number | null }) {
  const { t } = useI18n();
  return (
    <div>
      <label className="label flex items-center gap-1.5" htmlFor={id}>
        {t("yl.label")} <span className="text-subtle">{t("yl.forYear", { year: academicYear })}</span> <InfoTip text={t("yl.hint")} align="start" />
      </label>
      <select id={id} name="yearLevel" className="input" defaultValue={defaultValue ?? ""} data-testid="year-level">
        <option value="">{t("yl.none")}</option>
        {YEAR_LEVELS.map((n) => <option key={n} value={n}>{t("yl.level", { n })}</option>)}
      </select>
      <input type="hidden" name="academicYear" value={academicYear} />
    </div>
  );
}

export function CreateUserForm({ departments = [], academicYear }: { departments?: { code: string; label: string }[]; academicYear: number }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  const [role, setRole] = useState("STUDENT");
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
          <select id="cu-role" name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
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
      {role === "STUDENT" && <YearLevelField id="cu-year" academicYear={academicYear} />}
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
  const { t, tn, tm } = useI18n();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // The whole file is checked here first (so errors carry the file's line numbers), then sent in slices:
  // creating hundreds of accounts in one request would run past the server's time limit.
  const run = async (_: FormState, fd: FormData): Promise<FormState> => {
    const file = fd.get("file");
    const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("csv") ?? "");
    if (!text.trim()) return { error: t("err.csvMissing") };
    const { rows, errors } = parseUserImport(text);
    if (errors.length) return { error: t("err.csvRows", { rows: errors.slice(0, 10).map(tm).join("\n") }) };
    if (!rows.length) return { error: t("err.csvMissing") };
    const reissue = fd.get("reissue") === "on";
    const issued: Issued[] = [];
    const skipped: string[] = [];
    let reissued = 0, yearSet = 0, academicYear = 0;
    const summary = () =>
      tn("ok.imported", issued.length - reissued) +
      (reissued ? t("ok.importReissued", { n: reissued }) : "") +
      (yearSet ? t("ok.importYearSet", { n: yearSet, year: academicYear }) : "") +
      (skipped.length ? t("ok.importSkipped", { n: skipped.length, list: skipped.join(", ") }) : "");
    try {
      for (let i = 0; i < rows.length; i += USER_IMPORT_CHUNK) {
        setProgress({ done: i, total: rows.length });
        const slice = rows.slice(i, i + USER_IMPORT_CHUNK)
          .map((r) => [r.username, r.fullName, r.role, r.email, r.department, r.password, r.yearLevel]);
        const res = await importUsersChunkAction(toCsv(slice), reissue);
        if ("error" in res) return { error: res.error + (issued.length ? "\n" + summary() : ""), data: issued };
        issued.push(...res.issued, ...res.reissued);
        reissued += res.reissued.length;
        skipped.push(...res.skipped);
        yearSet += res.yearSet;
        academicYear = res.academicYear;
      }
    } catch {
      // Accounts created so far stay; their passwords are still shown. Importing the file again skips them.
      return { error: t("users.importBroken", { done: issued.length, total: rows.length }) + (issued.length ? "\n" + summary() : ""), data: issued };
    } finally {
      setProgress(null);
    }
    return { success: summary(), data: issued };
  };
  const [state, action, pending] = useActionState(run, undefined);
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
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-2.5 text-sm text-muted">
          <input type="checkbox" role="switch" name="reissue" className="toggle" /> {t("users.reissue")}
        </label>
        <InfoTip text={t("users.reissueHelp")} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={progress ? t("users.importProgress", progress) : t("users.importing")}>{t("users.importBtn")}</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </KeepForm>
  );
}

export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const [state, action] = useActionState(resetUserPasswordAction, undefined);
  const issued = (state?.data as Issued[] | undefined)?.[0];
  const { t } = useI18n();
  return (
    <ConfirmForm action={action} message={t("users.resetConfirm", { id: username })} confirmLabel={t("users.reset")} danger={false}>
      <input type="hidden" name="userId" value={userId} />
      {issued ? (
        <span className="badge bg-amber-500/10 px-2 py-1 font-mono text-sm text-warning" title={t("temp.shownOnce")}>
          {issued.password}
        </span>
      ) : (
        <SubmitButton className="btn-secondary" pendingText="…">{t("users.reset")}</SubmitButton>
      )}
    </ConfirmForm>
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
  /** Year level in the current academic year, and every year on record (cadets). */
  yearLevel: number | null;
  years: { academicYear: number; yearLevel: number }[];
};

/** Everything about one account in one place: details, then password reset and disabling. */
export function ManageUserForm({ user, departments, isSelf, academicYear }: { user: ManagedUser; departments: { code: string; label: string }[]; isSelf: boolean; academicYear: number }) {
  const [state, action, pending] = useActionState(updateUserAction.bind(null, user.id), undefined);
  const [role, setRole] = useState<string>(user.role);
  const { t } = useI18n();
  const id = (f: string) => `mu-${user.id}-${f}`;
  return (
    <div className="space-y-6">
      {/* Close on success: a renamed user moves in the sorted list, and the row (with this dialog) moves with it. */}
      <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label flex items-center gap-1.5" htmlFor={id("username")}>{t("login.id")} <InfoTip text={t("users.usernameHint")} align="start" /></label>
            <input id={id("username")} name="username" className="input font-mono" defaultValue={user.username} required />
          </div>
          <div>
            <label className="label" htmlFor={id("role")}>{t("account.role")}</label>
            <select id={id("role")} name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
              <option value="STUDENT">{t("role.STUDENT")}</option>
              <option value="INSTRUCTOR">{t("role.INSTRUCTOR")}</option>
              <option value="ADMIN">{t("role.ADMIN")}</option>
            </select>
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </div>
        </div>
        <div>
          <label className="label flex items-center gap-1.5" htmlFor={id("fullName")}>{t("users.fullName")} <InfoTip text={t("users.fullNameHint")} align="start" /></label>
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
        {role === "STUDENT" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <YearLevelField id={id("year")} academicYear={academicYear} defaultValue={user.yearLevel} />
            {user.years.length > 0 && (
              <div data-testid="year-history">
                <span className="label">{t("yl.history")}</span>
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  {user.years.map((y) => (
                    <li key={y.academicYear} className={`badge px-2 py-1 ${y.academicYear === academicYear ? "bg-accent/15 text-accent" : "bg-surface-3 text-muted"}`}>
                      {y.academicYear} · {t("yl.level", { n: y.yearLevel })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <FormMessage state={state} />
        <SubmitButton>{t("users.saveChanges")}</SubmitButton>
      </KeepForm>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">{t("users.accountActions")} <InfoTip text={t(user.isActive ? "users.disableHint" : "users.enableHint")} align="start" /></h3>
        <div className="flex flex-wrap items-center gap-3">
          <ResetPasswordButton userId={user.id} username={user.username} />
          {!isSelf && (
            <ConfirmForm action={toggleUserActiveAction} enabled={user.isActive} message={t("users.disableConfirm", { id: user.username })} confirmLabel={t("users.disable")}>
              <input type="hidden" name="userId" value={user.id} />
              <button className={user.isActive ? "btn-danger" : "btn-secondary"}>{t(user.isActive ? "users.disable" : "users.enable")}</button>
            </ConfirmForm>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * End-of-year promotion: shows how many cadets are in each year of `from`, then moves everyone up into the
 * next academic year. The final year graduates. Earlier years stay on each cadet's record.
 */
export function PromoteForm({ years, counts }: { years: number[]; counts: Record<number, Record<number, number>> }) {
  const [state, action, pending] = useActionState(promoteCadetsAction, undefined);
  const [from, setFrom] = useState(years[0]);
  const [finalYear, setFinalYear] = useState(DEFAULT_FINAL_YEAR);
  const { t } = useI18n();
  const c = counts[from] ?? {};
  const levels = YEAR_LEVELS.filter((n) => c[n]);
  return (
    <KeepForm action={action} pending={pending} state={state} className="space-y-4" data-testid="promote-form">
      <p className="text-xs leading-relaxed text-muted">{t("promo.help")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-from">{t("promo.from")}</label>
          <select id="promo-from" name="from" className="input" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{t("promo.fromTo", { from: y, to: y + 1 })}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5" htmlFor="promo-final">{t("promo.finalYear")} <InfoTip text={t("promo.finalYearHint")} align="start" /></label>
          <select id="promo-final" name="finalYear" className="input" value={finalYear} onChange={(e) => setFinalYear(Number(e.target.value))}>
            {YEAR_LEVELS.filter((n) => n >= 3).map((n) => <option key={n} value={n}>{t("yl.level", { n })}</option>)}
          </select>
        </div>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="promote-preview">
        {levels.length === 0 && <li className="px-3 py-3 text-center text-muted">{t("promo.err.none", { year: from })}</li>}
        {levels.map((n) => (
          <li key={n} className="flex items-center gap-3 px-3 py-2">
            <span className="w-24">{t("yl.level", { n })}</span>
            <span className="font-mono text-xs text-muted">{t("promo.count", { n: c[n] })}</span>
            <span className="ml-auto text-xs">
              {n >= finalYear ? <span className="text-warning">→ {t("promo.graduates")}</span> : <span className="text-success">→ {t("yl.level", { n: n + 1 })}</span>}
            </span>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2.5 text-sm text-muted">
        <input type="checkbox" role="switch" name="disableGraduates" className="toggle" /> {t("promo.disableGraduates")}
      </label>
      <FormMessage state={state} />
      <SubmitButton>{t("promo.submit", { to: from + 1 })}</SubmitButton>
    </KeepForm>
  );
}
