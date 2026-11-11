"use client";

import { useActionState, useState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { SectionCheckboxes, type SectionRef } from "@/components/SectionCheckboxes";
import { FileDropzone } from "@/components/FileDropzone";
import { addMaterialAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function AddMaterialForm({ offeringId, maxMb, sections = [] }: { offeringId: string; maxMb: number; sections?: SectionRef[] }) {
  const [state, action, pending] = useActionState(addMaterialAction.bind(null, offeringId), undefined);
  const [type, setType] = useState<"FILE" | "LINK">("FILE");
  const { t } = useI18n();
  const [clientError, setClientError] = useState<string | null>(null);
  const check = (fd: FormData) => {
    const f = fd.get("file");
    const err = f instanceof File && f.size > maxMb * 1024 * 1024 ? t("err.fileTooBig", { mb: maxMb }) : null;
    setClientError(err);
    return !err;
  };

  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess closeOnSuccess beforeSubmit={check} directUpload className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-xs" role="tablist">
        {(["FILE", "LINK"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={type === k}
            onClick={() => setType(k)}
            className={`rounded-md py-1.5 transition ${type === k ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
          >
            {k === "FILE" ? t("mat.upload") : t("mat.link")}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_4.5rem] gap-3">
        <div>
          <label className="label" htmlFor="title">{t("mat.title")}</label>
          <input id="title" name="title" className="input" required maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="week">{t("mat.week")}</label>
          <input id="week" name="week" type="number" min={0} max={30} className="input" />
        </div>
      </div>
      {type === "FILE" ? (
        <div>
          <label className="label" htmlFor="file">{t("mat.file")} <span className="text-subtle">{t("mat.max", { mb: maxMb })}</span></label>
          <FileDropzone id="file" name="file" required />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="url">{t("mat.url")}</label>
          <input id="url" name="url" type="url" className="input" placeholder="https://" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="description">{t("mat.description")} <span className="text-subtle">{t("common.optional")}</span></label>
        <textarea id="description" name="description" rows={2} className="input" maxLength={2000} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isPublished" defaultChecked role="switch" className="toggle" /> {t("mat.visible")}
      </label>
      <SectionCheckboxes sections={sections} />
      <FormMessage state={clientError ? { error: clientError } : state} />
      <SubmitButton className="btn w-full" pendingText={t("mat.uploading")}>{t("course.addMaterial")}</SubmitButton>
    </KeepForm>
  );
}
