"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { CLOSE_MS } from "./Modal";

/**
 * A form that asks in a dialog before it submits (delete, reset, disable…), instead of window.confirm().
 * Put the hidden inputs and the trigger button inside; `message` is the question, `confirmLabel` the
 * dialog's action button (defaults to the common "Confirm").
 */
export function ConfirmForm({
  action,
  message,
  title,
  confirmLabel,
  danger = true,
  enabled = true,
  className,
  children,
}: {
  action: (fd: FormData) => void | Promise<void>;
  message: string;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** False: submit straight away (e.g. re-enabling needs no question). */
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  const close = (then?: () => void) => {
    const d = dialog.current;
    if (!d?.open || d.dataset.closing) return;
    d.dataset.closing = "1";
    setTimeout(() => {
      delete d.dataset.closing;
      d.close();
      setOpen(false);
      then?.();
    }, CLOSE_MS);
  };

  return (
    <>
      <form
        ref={form}
        action={action}
        className={className}
        onSubmit={(e) => {
          if (!enabled || confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </form>
      {open && (
        <dialog
          ref={dialog}
          className="modal m-auto w-[calc(100%-2rem)] max-w-sm text-left rounded-2xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          aria-label={title ?? message}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onMouseDown={(e) => e.target === dialog.current && close()}
          data-testid="confirm-dialog"
        >
          <div className="p-5">
            <div className="flex gap-3">
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-full text-base ${danger ? "bg-red-500/10 text-danger" : "bg-accent/15 text-accent"}`} aria-hidden>
                {danger ? "!" : "?"}
              </span>
              <div className="min-w-0 pt-0.5">
                {title && <h2 className="mb-1 text-sm font-semibold">{title}</h2>}
                <p className="whitespace-pre-line text-sm text-muted">{message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary h-9 px-4 text-sm" onClick={() => close()} data-testid="confirm-cancel">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                autoFocus
                className={danger ? "btn bg-red-600 hover:bg-red-700" : "btn"}
                onClick={() =>
                  close(() => {
                    confirmed.current = true;
                    form.current?.requestSubmit();
                  })
                }
                data-testid="confirm-ok"
              >
                {confirmLabel ?? t("common.confirm")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
