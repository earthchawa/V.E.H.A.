"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage } from "./FormMessage";
import { KeepForm } from "./KeepForm";
import { Modal } from "./Modal";
import { SectionOption, type SectionRef } from "./SectionCheckboxes";
import { SubmitButton } from "./SubmitButton";

type Kind = "material" | "assignment" | "gradebook";

/**
 * "Copy to other sections": a dialog that names what is being copied, shows each other section of this
 * course (with its instructor and cadet count), and spells out what is and is not copied.
 */
export function CopyToSections({
  action,
  itemId,
  sections,
  kind,
  itemTitle,
  menuItem = false,
}: {
  /** Render the trigger as an item of a <MoreMenu>. */
  menuItem?: boolean;
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  itemId: string;
  sections: SectionRef[];
  kind: Kind;
  /** Name of the material / assignment being copied (not used for the gradebook setup). */
  itemTitle?: string;
}) {
  const { t } = useI18n();
  if (!sections.length) return null;
  return (
    <Modal
      label={<><span className={menuItem ? "menu-icon" : undefined} aria-hidden>⧉</span> {t("sec.copyTo")}</>}
      title={t("sec.copyTitle")}
      buttonClassName={menuItem ? "menu-item" : "btn-secondary"}
      testId={`copy-${kind}`}
    >
      <CopyForm action={action} itemId={itemId} sections={sections} kind={kind} itemTitle={itemTitle} />
    </Modal>
  );
}

function CopyForm({ action, itemId, sections, kind, itemTitle }: Parameters<typeof CopyToSections>[0]) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={dispatch} pending={pending} state={state} closeOnSuccess className="space-y-4" data-testid="copy-form">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
        <div className="text-xs text-subtle">{t("sec.copyWhat")}</div>
        <div className="font-medium">{kind === "gradebook" ? t("sec.kind.gradebook") : `${t(`sec.kind.${kind}`)} · ${itemTitle ?? ""}`}</div>
      </div>

      <fieldset>
        <legend className="label">{t("sec.copyWhere")}</legend>
        <div className="grid gap-2">
          {sections.map((s) => <SectionOption key={s.id} s={s} name="target" defaultChecked={sections.length === 1} />)}
        </div>
      </fieldset>

      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <div className="mb-1 font-medium text-success">✓ {t("sec.copied.yes")}</div>
          <p className="leading-relaxed text-muted">{t(`sec.yes.${kind}`)}</p>
        </div>
        <div>
          <div className="mb-1 font-medium text-muted">✕ {t("sec.copied.no")}</div>
          <p className="leading-relaxed text-muted">{t(`sec.no.${kind}`)}</p>
        </div>
      </div>
      <p className="rounded-lg border border-border px-3 py-2 text-xs leading-relaxed text-muted">{t("sec.copyNote")}</p>

      {state?.error && <FormMessage state={state} />}
      <SubmitButton>{t("sec.copy")}</SubmitButton>
    </KeepForm>
  );
}
