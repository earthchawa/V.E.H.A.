"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { moveFilesToBlobAction } from "../actions";

export function MoveFilesForm() {
  const [state, action, pending] = useActionState(moveFilesToBlobAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} className="space-y-3" data-testid="move-files">
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary h-9 px-4 text-sm" pendingText={t("sys.move.working")}>{t("sys.move.button")}</SubmitButton>
    </KeepForm>
  );
}
