import type { FormState } from "@/lib/form";

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="whitespace-pre-line rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state?.success)
    return (
      <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-success">
        {state.success}
      </p>
    );
  return null;
}
