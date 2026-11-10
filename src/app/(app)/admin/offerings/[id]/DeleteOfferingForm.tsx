"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { deleteOfferingAction } from "../../actions";

export type OfferingCounts = { people: number; materials: number; assignments: number; submissions: number; quizzes: number; gradeItems: number };

/** Deleting a section removes everything in it, so it lists what will go and asks for the course code. */
export function DeleteOfferingForm({ offeringId, code, counts }: { offeringId: string; code: string; counts: OfferingCounts }) {
  const [state, action, pending] = useActionState(deleteOfferingAction.bind(null, offeringId), undefined);
  const { t } = useI18n();
  const rows: [string, number][] = [
    [t("off.del.people"), counts.people],
    [t("off.del.materials"), counts.materials],
    [t("off.del.assignments"), counts.assignments],
    [t("off.del.submissions"), counts.submissions],
    [t("off.del.quizzes"), counts.quizzes],
    [t("off.del.gradeItems"), counts.gradeItems],
  ];
  const empty = rows.every(([, n]) => n === 0);
  return (
    <KeepForm action={action} pending={pending} state={state} className="space-y-4" data-testid="delete-offering-form">
      <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-danger">{t(empty ? "off.del.warnEmpty" : "off.del.warn")}</p>
      {!empty && (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3" data-testid="delete-offering-counts">
          {rows.map(([label, n]) => (
            <li key={label} className="flex justify-between gap-2">
              <span className="text-muted">{label}</span>
              <span className={`font-mono ${n ? "text-fg" : "text-subtle"}`}>{n}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t("off.del.keeps")}</p>
      <div>
        <label className="label" htmlFor="del-confirm">{t("off.del.type", { code })}</label>
        <input id="del-confirm" name="confirm" className="input font-mono" autoComplete="off" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn bg-red-600 hover:bg-red-700">{t("off.del.submit")}</SubmitButton>
    </KeepForm>
  );
}
