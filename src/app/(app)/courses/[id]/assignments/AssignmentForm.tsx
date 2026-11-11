"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState, useState } from "react";
import { saveAssignmentAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { SectionCheckboxes, type SectionRef } from "@/components/SectionCheckboxes";
import { InfoTip } from "@/components/InfoTip";

export type AssignmentDefaults = {
  title: string;
  instructions: string;
  dueAt: string; // Bangkok datetime-local
  allowLate: boolean;
  isPublished: boolean;
  checkSimilarity: boolean;
  ignoreCommon: boolean;
  reportVisibility: "IMMEDIATE" | "AFTER_DUE" | "HIDDEN";
  baseText: string;
  points: string;
  categoryId: string;
};

const EMPTY: AssignmentDefaults = {
  title: "",
  instructions: "",
  dueAt: "",
  allowLate: true,
  isPublished: true,
  checkSimilarity: true,
  ignoreCommon: true,
  reportVisibility: "IMMEDIATE",
  baseText: "",
  points: "",
  categoryId: "",
};

export function AssignmentForm({
  offeringId,
  assignmentId = null,
  defaults = EMPTY,
  categories = [],
  sections = [],
  closeOnSuccess = false,
}: {
  offeringId: string;
  assignmentId?: string | null;
  defaults?: AssignmentDefaults;
  categories?: { id: string; name: string }[];
  /** Other sections to optionally create the assignment in too (create mode only). */
  sections?: SectionRef[];
  closeOnSuccess?: boolean;
}) {
  const [state, action, pending] = useActionState(saveAssignmentAction.bind(null, offeringId, assignmentId), undefined);
  const { t } = useI18n();
  const d = defaults;
  const [check, setCheck] = useState(d.checkSimilarity);
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess={closeOnSuccess} className="space-y-4">
      <div>
        <label className="label" htmlFor="a-title">{t("asg.f.title")}</label>
        <input id="a-title" name="title" className="input" defaultValue={d.title} required maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="a-instructions">{t("asg.f.instructions")}</label>
        <textarea id="a-instructions" name="instructions" rows={4} className="input" defaultValue={d.instructions} />
      </div>
      <div>
        <label className="label flex items-center gap-1.5" htmlFor="a-due">{t("asg.f.due")} <InfoTip text={t("asg.f.dueHint")} align="start" /></label>
        <input id="a-due" name="dueAt" type="datetime-local" className="input" defaultValue={d.dueAt} />
      </div>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div>
          <label className="label flex items-center gap-1.5" htmlFor="a-points">{t("asg.f.points")} <InfoTip text={t("asg.f.pointsHint")} align="start" /></label>
          <input id="a-points" name="points" inputMode="decimal" className="input" defaultValue={d.points} />
        </div>
        <div>
          <label className="label" htmlFor="a-cat">{t("asg.f.category")}</label>
          <select id="a-cat" name="categoryId" className="input" defaultValue={d.categoryId}>
            <option value="">{t("gr.noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {/* On/off settings: one row each, label on the left, switch on the right. */}
      <div className="divide-y divide-border rounded-lg border border-border text-sm">
        <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
          {t("asg.f.published")}
          <input type="checkbox" name="isPublished" defaultChecked={d.isPublished} role="switch" className="toggle" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
          {t("asg.f.allowLate")}
          <input type="checkbox" name="allowLate" defaultChecked={d.allowLate} role="switch" className="toggle" />
        </label>
      </div>

      {/* Similarity checking and the settings that only matter when it is on, as one group. */}
      <fieldset className="rounded-lg border border-border text-sm" data-testid="similarity-settings">
        <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
          <span className="font-medium">{t("asg.f.check")}</span>
          <input type="checkbox" name="checkSimilarity" checked={check} onChange={(e) => setCheck(e.target.checked)} role="switch" className="toggle" />
        </label>
        {/* Hidden, not removed, when off: the values are still posted, so switching back on keeps them. */}
        <div hidden={!check} className="space-y-4 border-t border-border bg-surface-2/60 px-3 py-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5">{t("asg.f.ignoreCommon")} <InfoTip text={t("asg.f.ignoreCommonHint")} align="start" /></span>
            <input type="checkbox" name="ignoreCommon" defaultChecked={d.ignoreCommon} role="switch" className="toggle" />
          </label>
          <div>
            <label className="label" htmlFor="a-vis">{t("asg.f.reportVis")}</label>
            <select id="a-vis" name="reportVisibility" className="input" defaultValue={d.reportVisibility}>
              <option value="IMMEDIATE">{t("vis.IMMEDIATE")}</option>
              <option value="AFTER_DUE">{t("vis.AFTER_DUE")}</option>
              <option value="HIDDEN">{t("vis.HIDDEN")}</option>
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5" htmlFor="a-base">{t("asg.f.baseText")} <span className="text-subtle">{t("common.optional")}</span> <InfoTip text={t("asg.f.baseHint")} align="start" /></label>
            <textarea id="a-base" name="baseText" rows={3} className="input font-mono text-xs" defaultValue={d.baseText} />
          </div>
        </div>
      </fieldset>
      {!assignmentId && <SectionCheckboxes sections={sections} />}
      <FormMessage state={state} />
      <SubmitButton>{t(assignmentId ? "asg.f.save" : "asg.f.create")}</SubmitButton>
    </KeepForm>
  );
}
