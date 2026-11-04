"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { saveAssignmentAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export type AssignmentDefaults = {
  title: string;
  instructions: string;
  dueAt: string; // Bangkok datetime-local
  allowLate: boolean;
  isPublished: boolean;
  checkSimilarity: boolean;
  reportVisibility: "IMMEDIATE" | "AFTER_DUE" | "HIDDEN";
  baseText: string;
};

const EMPTY: AssignmentDefaults = {
  title: "",
  instructions: "",
  dueAt: "",
  allowLate: true,
  isPublished: true,
  checkSimilarity: true,
  reportVisibility: "IMMEDIATE",
  baseText: "",
};

export function AssignmentForm({
  offeringId,
  assignmentId = null,
  defaults = EMPTY,
}: {
  offeringId: string;
  assignmentId?: string | null;
  defaults?: AssignmentDefaults;
}) {
  const [state, action, pending] = useActionState(saveAssignmentAction.bind(null, offeringId, assignmentId), undefined);
  const { t } = useI18n();
  const d = defaults;
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="a-title">{t("asg.f.title")}</label>
        <input id="a-title" name="title" className="input" defaultValue={d.title} required maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="a-instructions">{t("asg.f.instructions")}</label>
        <textarea id="a-instructions" name="instructions" rows={4} className="input" defaultValue={d.instructions} />
      </div>
      <div>
        <label className="label" htmlFor="a-due">{t("asg.f.due")}</label>
        <input id="a-due" name="dueAt" type="datetime-local" className="input" defaultValue={d.dueAt} />
        <p className="mt-1.5 text-xs text-subtle">{t("asg.f.dueHint")}</p>
      </div>
      <div className="space-y-2 text-sm text-muted">
        <label className="flex items-center gap-2"><input type="checkbox" name="allowLate" defaultChecked={d.allowLate} className="accent-accent" /> {t("asg.f.allowLate")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={d.isPublished} className="accent-accent" /> {t("asg.f.published")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="checkSimilarity" defaultChecked={d.checkSimilarity} className="accent-accent" /> {t("asg.f.check")}</label>
      </div>
      <div>
        <label className="label" htmlFor="a-vis">{t("asg.f.reportVis")}</label>
        <select id="a-vis" name="reportVisibility" className="input" defaultValue={d.reportVisibility}>
          <option value="IMMEDIATE">{t("vis.IMMEDIATE")}</option>
          <option value="AFTER_DUE">{t("vis.AFTER_DUE")}</option>
          <option value="HIDDEN">{t("vis.HIDDEN")}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="a-base">{t("asg.f.baseText")} <span className="text-subtle">{t("common.optional")}</span></label>
        <textarea id="a-base" name="baseText" rows={3} className="input font-mono text-xs" defaultValue={d.baseText} />
        <p className="mt-1.5 text-xs text-subtle">{t("asg.f.baseHint")}</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t(assignmentId ? "asg.f.save" : "asg.f.create")}</SubmitButton>
    </KeepForm>
  );
}
