"use client";

import { useFormStatus } from "react-dom";
import { useI18n } from "@/lib/i18n/client";
import { useKeepFormPending } from "./KeepForm";

export function SubmitButton({
  children,
  pendingText,
  className = "btn",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const status = useFormStatus();
  const keepPending = useKeepFormPending();
  const pending = keepPending ?? status.pending;
  const { t } = useI18n();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? t("common.working")) : children}
    </button>
  );
}
