"use client";

import { createContext, useContext, useEffect, useRef, useTransition, type FormHTMLAttributes } from "react";
import type { FormState } from "@/lib/form";

const PendingContext = createContext<boolean | null>(null);
export const useKeepFormPending = () => useContext(PendingContext);

/**
 * A form for useActionState that does NOT reset its fields after submitting.
 * (React 19 resets `<form action>` forms automatically, which would wipe a cadet's typed
 * answer when the server returns a validation error.) Fields are cleared only when
 * `resetOnSuccess` is set and the action succeeds.
 */
export function KeepForm({
  action,
  pending,
  state,
  resetOnSuccess = false,
  children,
  ...rest
}: {
  action: (fd: FormData) => void;
  pending: boolean;
  state?: FormState;
  resetOnSuccess?: boolean;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        {...rest}
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}
