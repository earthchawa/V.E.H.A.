"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { gradeSubmissionAction } from "@/app/(app)/courses/[id]/grades/actions";
import { InfoTip } from "@/components/InfoTip";

/** Instructor grading box on the report page: points + feedback for this submission. */
export function GradePanel({
  itemId,
  studentId,
  maxPoints,
  points,
  feedback,
  released,
}: {
  itemId: string;
  studentId: string;
  maxPoints: number;
  points: number | null;
  feedback: string | null;
  released: boolean;
}) {
  const [state, action, pending] = useActionState(gradeSubmissionAction.bind(null, itemId, studentId), undefined);
  const { t } = useI18n();
  return (
    <section className="card mb-6">
      <KeepForm action={action} pending={pending} className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <div>
          <label className="label inline-flex items-center gap-1.5" htmlFor="g-points">{t("gr.gradeThis")} <span className="text-subtle">{t("gr.outOf", { max: maxPoints })}</span>{!released && <InfoTip text={t("gr.notReleasedNote")} align="start" />}</label>
          <input id="g-points" name="points" inputMode="decimal" defaultValue={points ?? ""} className="input font-mono" />
        </div>
        <div>
          <label className="label" htmlFor="g-feedback">{t("gr.feedback")}</label>
          <textarea id="g-feedback" name="feedback" rows={1} defaultValue={feedback ?? ""} className="input min-h-9" />
        </div>
        <SubmitButton>{t("gr.saveGrade")}</SubmitButton>
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      </KeepForm>
    </section>
  );
}
