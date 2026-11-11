"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormHTMLAttributes } from "react";
import type { FormState } from "@/lib/form";
import { useModal } from "./Modal";
import { toast } from "./Toaster";
import { uploadFormFiles, useUploadConfig } from "./direct-upload";
import { useI18n } from "@/lib/i18n/client";

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
  directUpload = false,
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
  /**
   * With Blob storage: send this form's files straight from the browser to the store and post references
   * instead (the action reads them with incomingFiles()). Without Blob storage it changes nothing.
   */
  directUpload?: boolean;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const uploadCfg = useUploadConfig();
  const { t } = useI18n();
  /** null = not uploading; otherwise percent sent. */
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState(false);

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
    <PendingContext.Provider value={pending || uploading != null}>
      <form
        {...rest}
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          // Include the clicked button (name/value), like a native submit.
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          if (beforeSubmit && !beforeSubmit(fd)) return;
          if (!directUpload || !uploadCfg.direct) return startTransition(() => action(fd));
          if (uploading != null) return;
          setUploadError(false);
          setUploading(0);
          uploadFormFiles(fd, uploadCfg, setUploading)
            .then((sent) => startTransition(() => action(sent)))
            .catch(() => setUploadError(true))
            .finally(() => setUploading(null));
        }}
      >
        {children}
        {uploading != null && (
          <div className="mt-3" role="status" data-testid="upload-progress">
            <div className="mb-1 text-xs text-muted">{t("up.sending", { n: uploading })}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${uploading}%` }} />
            </div>
          </div>
        )}
        {uploadError && <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-danger">{t("up.failed")}</p>}
      </form>
    </PendingContext.Provider>
  );
}
