"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Matches the modal-out animation in globals.css. */
export const CLOSE_MS = 140;

const ModalContext = createContext<{ close: () => void } | null>(null);
/** Inside a <Modal>: close it (e.g. after a successful save). */
export const useModal = () => useContext(ModalContext);

/**
 * Button that opens a dialog. Uses the native <dialog> (Esc closes it, focus is trapped).
 * Children mount only while open, so forms start fresh each time.
 */
export function Modal({
  label,
  title,
  children,
  buttonClassName = "btn",
  size = "md",
  testId,
}: {
  label: React.ReactNode;
  title: string;
  children: React.ReactNode;
  buttonClassName?: string;
  size?: "md" | "lg";
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState(0);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Play the closing animation (globals.css, dialog.modal[data-closing]) before the dialog really closes.
  const close = useCallback(() => {
    const d = ref.current;
    if (!d?.open || d.dataset.closing) return;
    d.dataset.closing = "1";
    closing.current = setTimeout(() => {
      delete d.dataset.closing;
      setOpen(false);
    }, CLOSE_MS);
  }, []);
  // Opening again while the last close is still animating: stay open with a fresh form.
  const show = () => {
    const d = ref.current;
    if (d?.dataset.closing) {
      if (closing.current) clearTimeout(closing.current);
      delete d.dataset.closing;
      setRun((n) => n + 1);
    }
    setOpen(true);
  };
  const ctx = useMemo(() => ({ close }), [close]);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={show} data-testid={testId}>
        {label}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        // Esc: animate out instead of closing at once.
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        // Click on the backdrop (outside the panel) closes.
        onMouseDown={(e) => e.target === ref.current && close()}
        className={`modal m-auto w-[calc(100%-2rem)] text-left ${size === "lg" ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
        aria-label={title}
      >
        {open && (
          <ModalContext.Provider value={ctx} key={run}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">{title}</h2>
              <button type="button" onClick={close} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-fg" aria-label={t("common.close")}>
                ✕
              </button>
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">{children}</div>
          </ModalContext.Provider>
        )}
      </dialog>
    </>
  );
}
