"use client";

import { createContext, useContext, useEffect, useRef, useTransition, type FormHTMLAttributes } from "react";
import type { FormState } from "@/lib/form";
import { useModal } from "./Modal";
import { toast } from "./Toaster";

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
  closeOnSuccess = false,
  beforeSubmit,
  children,
  ...rest
}: {
  action: (fd: FormData) => void;
  pending: boolean;
  state?: FormState;
  resetOnSuccess?: boolean;
  /** Inside a <Modal>: close it when the action succeeds. */
  closeOnSuccess?: boolean;
  /** Client-side check; return false to cancel the submit (e.g. a file over the upload cap). */
  beforeSubmit?: (fd: FormData) => boolean;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  const modal = useModal();
  useEffect(() => {
    if (!state?.success) return;
    if (resetOnSuccess) ref.current?.reset();
    if (closeOnSuccess && modal) {
      // The dialog (and its inline message) is about to go: confirm with a toast instead.
      toast(state.success);
      modal.close();
    }
  }, [state, resetOnSuccess, closeOnSuccess, modal]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        {...rest}
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          // Include the clicked button (name/value), like a native submit.
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          if (beforeSubmit && !beforeSubmit(fd)) return;
          startTransition(() => action(fd));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}
