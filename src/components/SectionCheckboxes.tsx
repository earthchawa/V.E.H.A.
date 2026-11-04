"use client";

import { useI18n } from "@/lib/i18n/client";

export type SectionRef = { id: string; section: string };

/** "Also add to: ☐ Sec 2 ☐ Sec 3" inside a create form. Renders nothing when there are no other sections. */
export function SectionCheckboxes({ sections, name = "alsoTo" }: { sections: SectionRef[]; name?: string }) {
  const { t } = useI18n();
  if (!sections.length) return null;
  return (
    <fieldset className="rounded-lg border border-border px-3 py-2">
      <legend className="px-1 text-xs text-muted">{t("sec.alsoAddTo")}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {sections.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={s.id} className="accent-accent" />
            {t("dash.section", { s: s.section })}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
