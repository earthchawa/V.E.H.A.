"use client";

import { useI18n } from "@/lib/i18n/client";
import { InfoTip } from "./InfoTip";

export type SectionRef = { id: string; section: string; instructors?: string[]; cadets?: number };

/** One selectable section: number, who teaches it and how many cadets, so it is clear which class it is. */
export function SectionOption({ s, name, defaultChecked }: { s: SectionRef; name: string; defaultChecked?: boolean }) {
  const { t, tn } = useI18n();
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10">
      <input type="checkbox" name={name} value={s.id} defaultChecked={defaultChecked} className="h-4 w-4 accent-accent" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{t("dash.section", { s: s.section })}</span>
        {(s.instructors?.length || s.cadets != null) && (
          <span className="block truncate text-xs text-subtle">
            {[s.instructors?.join(", "), s.cadets != null ? tn("tc.cadetCount", s.cadets) : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </label>
  );
}

/** "Also create in: ☐ Section 2 ☐ Section 3" inside a create form. Renders nothing when there are no other sections. */
export function SectionCheckboxes({ sections, name = "alsoTo" }: { sections: SectionRef[]; name?: string }) {
  const { t } = useI18n();
  if (!sections.length) return null;
  return (
    <fieldset className="rounded-lg border border-border px-3 pb-3 pt-2">
      <legend className="flex items-center gap-1.5 px-1 text-xs text-muted">
        {t("sec.alsoAddTo")} <InfoTip text={t("sec.alsoAddHint")} align="start" />
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {sections.map((s) => <SectionOption key={s.id} s={s} name={name} />)}
      </div>
    </fieldset>
  );
}
