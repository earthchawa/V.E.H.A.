"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { submitAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { SUBMISSION_LIMITS } from "@/lib/assignments";

export function SubmitForm({
  assignmentId,
  defaultText,
  hasFiles,
  resubmit,
}: {
  assignmentId: string;
  defaultText: string;
  hasFiles: boolean;
  resubmit: boolean;
}) {
  const [state, action, pending] = useActionState(submitAction.bind(null, assignmentId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="s-text">{t("asg.text")}</label>
        <textarea id="s-text" name="textAnswer" rows={8} className="input" defaultValue={defaultText} />
      </div>
      <div>
        <label className="label" htmlFor="s-files">{t("asg.files")}</label>
        <input id="s-files" name="files" type="file" multiple className="input" />
        <p className="mt-1.5 text-xs text-subtle">
          {t("asg.filesHint", { n: SUBMISSION_LIMITS.maxFiles, mb: SUBMISSION_LIMITS.maxFileMb })}
          {hasFiles && <> {t("asg.keepFiles")}</>}
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={t("asg.submitting")}>{t(resubmit ? "asg.resubmit" : "asg.submit")}</SubmitButton>
    </KeepForm>
  );
}
