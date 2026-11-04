"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { useI18n } from "@/lib/i18n/client";
import { KeepForm } from "./KeepForm";
import { SubmitButton } from "./SubmitButton";
import type { SectionRef } from "./SectionCheckboxes";

/** Small "Copy to…" menu for an existing material / assignment / gradebook setup. */
export function CopyToSections({
  action,
  itemId,
  sections,
  label,
  hint,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  itemId: string;
  sections: SectionRef[];
  label?: string;
  hint?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const { t } = useI18n();
  if (!sections.length) return null;
  return (
    <details className="group relative">
      <summary className="btn-secondary cursor-pointer list-none">{label ?? t("sec.copyTo")}</summary>
      <div className="absolute right-0 z-10 mt-1 w-60 rounded-lg border border-border bg-surface p-3 shadow-lg">
        <KeepForm action={dispatch} pending={pending} className="space-y-2">
          <input type="hidden" name="itemId" value={itemId} />
          {hint && <p className="text-xs text-subtle">{hint}</p>}
          {sections.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="target" value={s.id} className="accent-accent" />
              {t("dash.section", { s: s.section })}
            </label>
          ))}
          <SubmitButton className="btn h-8 w-full">{t("sec.copy")}</SubmitButton>
          {state?.success && <p className="text-xs text-success">{state.success}</p>}
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
        </KeepForm>
      </div>
    </details>
  );
}
