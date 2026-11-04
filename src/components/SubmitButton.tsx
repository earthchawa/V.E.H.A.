"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "กำลังดำเนินการ…",
  className = "btn",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
