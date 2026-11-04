"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState, useState } from "react";
import { submitAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import type { uploadLimits } from "@/lib/assignments";
import { FileDropzone } from "@/components/FileDropzone";

export function SubmitForm({
  assignmentId,
  defaultText,
  hasFiles,
  resubmit,
  limits,
}: {
  assignmentId: string;
  defaultText: string;
  hasFiles: boolean;
  resubmit: boolean;
  limits: ReturnType<typeof uploadLimits>;
}) {
  const [state, action, pending] = useActionState(submitAction.bind(null, assignmentId), undefined);
  const { t } = useI18n();
  const [clientError, setClientError] = useState<string | null>(null);
  const check = (fd: FormData) => {
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const MB = 1024 * 1024;
    const err =
      files.length > limits.maxFiles ? t("err.tooManyFiles", { n: limits.maxFiles })
      : files.some((f) => f.size > limits.fileMb * MB) ? t("err.fileTooBig", { mb: limits.fileMb })
      : files.reduce((n, f) => n + f.size, 0) > limits.totalMb * MB ? t("err.filesTooBig", { mb: limits.totalMb })
      : null;
    setClientError(err);
    return !err;
  };
  return (
    <KeepForm action={action} pending={pending} beforeSubmit={check} className="space-y-4">
      <div>
        <label className="label" htmlFor="s-text">{t("asg.text")}</label>
        <textarea id="s-text" name="textAnswer" rows={8} className="input" defaultValue={defaultText} />
      </div>
      <div>
        <label className="label" htmlFor="s-files">{t("asg.files")}</label>
        <FileDropzone id="s-files" name="files" multiple />
        <p className="mt-1.5 text-xs text-subtle">
          {t("asg.filesHint", { n: limits.maxFiles, mb: limits.fileMb })}
          {hasFiles && <> {t("asg.keepFiles")}</>}
        </p>
      </div>
      <FormMessage state={clientError ? { error: clientError } : state} />
      <SubmitButton pendingText={t("asg.submitting")}>{t(resubmit ? "asg.resubmit" : "asg.submit")}</SubmitButton>
    </KeepForm>
  );
}
