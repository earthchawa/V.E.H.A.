"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import type { ScaleRow } from "@/lib/grades";
import { addCategoryAction, addItemAction, saveScaleAction, updateCategoryAction } from "./actions";

export function CategoryRowForm({ id, name, weight }: { id: string; name: string; weight: number }) {
  const [state, action, pending] = useActionState(updateCategoryAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="categoryId" value={id} />
      <input name="name" defaultValue={name} className="input h-8 min-w-0 flex-1 py-0" aria-label={t("gr.catName")} required />
      <input name="weight" defaultValue={weight} inputMode="decimal" className="input h-8 w-20 py-0 text-right" aria-label={t("gr.weight")} required />
      <SubmitButton className="btn-secondary">{t("asg.f.save")}</SubmitButton>
      {state?.error && <span className="w-full text-xs text-danger">{state.error}</span>}
    </KeepForm>
  );
}

export function AddCategoryForm({ offeringId }: { offeringId: string }) {
  const [state, action, pending] = useActionState(addCategoryAction.bind(null, offeringId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-2">
      <div className="flex gap-2">
        <input name="name" placeholder={t("gr.catName")} className="input h-9 flex-1" required />
        <input name="weight" placeholder="%" inputMode="decimal" className="input h-9 w-20 text-right" required />
        <SubmitButton className="btn h-9">{t("gr.addCategory")}</SubmitButton>
      </div>
      {state?.error && <FormMessage state={state} />}
    </KeepForm>
  );
}

export function AddItemForm({ offeringId, categories }: { offeringId: string; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addItemAction.bind(null, offeringId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem]">
        <input name="title" placeholder={t("gr.itemTitle")} className="input h-9" aria-label={t("gr.itemTitle")} required />
        <input name="maxPoints" placeholder={t("gr.maxPoints")} inputMode="decimal" className="input h-9" aria-label={t("gr.maxPoints")} required />
        <select name="categoryId" className="input h-9 py-0" aria-label={t("gr.category")}>
          <option value="">{t("gr.noCategory")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="isReleased" className="accent-accent" /> {t("gr.released")}</label>
        <SubmitButton className="btn-secondary">{t("gr.addItem")}</SubmitButton>
      </div>
      {state?.error && <FormMessage state={state} />}
    </KeepForm>
  );
}

export function ScaleForm({ offeringId, scale }: { offeringId: string; scale: ScaleRow[] }) {
  const [state, action, pending] = useActionState(saveScaleAction.bind(null, offeringId), undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} className="max-w-xs space-y-3">
      <table className="table">
        <thead><tr><th>{t("gr.letter")}</th><th>{t("gr.min")}</th></tr></thead>
        <tbody>
          {scale.map((r, i) => (
            <tr key={i}>
              <td className="py-1"><input name="letter" defaultValue={r.letter} className="input h-8 w-16 py-0" aria-label={t("gr.letter")} /></td>
              <td className="py-1"><input name="min" defaultValue={r.min} inputMode="decimal" className="input h-8 w-20 py-0 text-right" aria-label={t("gr.min")} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2">
        <SubmitButton className="btn-secondary">{t("gr.saveScale")}</SubmitButton>
        <button name="reset" value="1" className="text-xs text-muted hover:text-fg">{t("gr.resetScale")}</button>
      </div>
      <FormMessage state={state} />
    </KeepForm>
  );
}
