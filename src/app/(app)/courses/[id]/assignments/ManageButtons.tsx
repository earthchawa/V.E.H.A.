"use client";

import { useActionState } from "react";
import { recheckAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function RecheckButton({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(recheckAction, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton className="btn-secondary">{t("asg.recheck")}</SubmitButton>
      {state?.success && <span className="text-xs text-success">{state.success}</span>}
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
