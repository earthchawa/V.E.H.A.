"use client";

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
    <form action={action} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name={name} value={value} />
      <button className="btn-danger h-8">{label}</button>
    </form>
  );
}
