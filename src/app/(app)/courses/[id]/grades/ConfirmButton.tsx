"use client";

import { ConfirmForm } from "@/components/ConfirmForm";

/** A small destructive-action form that asks for confirmation first. */
export function ConfirmButton({
  action,
  name,
  value,
  message,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  name: string;
  value: string;
  message: string;
  label: string;
}) {
  return (
    <ConfirmForm action={action} message={message} confirmLabel={label}>
      <input type="hidden" name={name} value={value} />
      <button className="btn-danger h-8">{label}</button>
    </ConfirmForm>
  );
}
