"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDropzone } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n/client";
import { addPastAssignmentSourceAction, addReferenceDocumentAction, generateAiAnswersAction } from "./actions";

/** Add a reference document: pasted text (a web page, a model answer, an AI chatbot's answer) and/or files. */
export function ReferenceDocumentForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(addReferenceDocumentAction.bind(null, assignmentId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess closeOnSuccess directUpload className="space-y-4">
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">{t("src.docHint")}</p>
      <div>
        <label className="label" htmlFor="src-title">{t("src.title")}</label>
        <input id="src-title" name="title" className="input" required placeholder={t("src.titlePlaceholder")} />
      </div>
      <div>
        <label className="label" htmlFor="src-url">{t("src.url")} <span className="text-subtle">({t("common.optional")})</span></label>
        <input id="src-url" name="url" type="url" className="input" placeholder="https://" />
      </div>
      <div>
        <label className="label" htmlFor="src-text">{t("src.text")}</label>
        <textarea id="src-text" name="text" rows={8} className="input font-mono text-[13px]" placeholder={t("src.textPlaceholder")} />
      </div>
      <div>
        <span className="label">{t("src.files")} <span className="text-subtle">({t("common.optional")})</span></span>
        <FileDropzone id="src-files" name="files" multiple />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("src.add")}</SubmitButton>
    </KeepForm>
  );
}

export type PastOption = { id: string; label: string; submissions: number };

/** Compare with all submissions to this course's assignment in an earlier term or another section. */
export function PastAssignmentForm({ assignmentId, options }: { assignmentId: string; options: PastOption[] }) {
  const [state, action, pending] = useActionState(addPastAssignmentSourceAction.bind(null, assignmentId), undefined);
  const { t } = useI18n();
  // The form stays mounted even when nothing is left to add, so it can close the dialog after a success.
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
      {!options.length ? (
        <p className="text-sm text-muted">{t("src.noPast")}</p>
      ) : (
        <>
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">{t("src.pastHint")}</p>
      <div>
        <label className="label" htmlFor="src-past">{t("src.pastAssignment")}</label>
        <select id="src-past" name="pastAssignmentId" className="input" required>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{`${o.label} (${t("src.subsCount", { n: o.submissions })})`}</option>
          ))}
        </select>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("src.add")}</SubmitButton>
        </>
      )}
    </KeepForm>
  );
}

/** Ask an AI model the assignment's own question and keep its answers as reference documents. */
export function AiAnswersForm({ assignmentId, variants, model }: { assignmentId: string; variants: number; model: string }) {
  const [state, action, pending] = useActionState(generateAiAnswersAction.bind(null, assignmentId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4" data-testid="ai-answers-form">
      <p className="text-sm leading-relaxed text-muted">{t("ai.explain", { n: variants })}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
        <li>{t("ai.note.sent")}</li>
        <li>{t("ai.note.limits")}</li>
        <li>{t("ai.note.model", { model })}</li>
      </ul>
      <FormMessage state={state} />
      <SubmitButton pendingText={t("ai.working")}>{t("ai.generate", { n: variants })}</SubmitButton>
    </KeepForm>
  );
}
