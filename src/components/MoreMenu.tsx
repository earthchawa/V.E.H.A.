"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { ConfirmForm } from "./ConfirmForm";

/**
 * "⋯" button that opens a small menu of less-used actions (settings, copy, delete…), so a header or row
 * keeps only its main action visible. Items are `menu-item` buttons: a <Modal buttonClassName="menu-item">,
 * a <MenuConfirm> or a plain link/button.
 *
 * Dialogs opened from an item live inside the menu, so the menu stays open behind them and closes once
 * that dialog has closed. Clicks inside an open dialog and Esc that closes a dialog leave the menu alone.
 */
export function MoreMenu({ children, testId, label }: { children: React.ReactNode; testId?: string; label?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const r = root.current;
    if (!open || !r) return;
    const dialogOpen = () => !!r.querySelector("dialog[open]");
    const down = (e: PointerEvent) => {
      if (!dialogOpen() && !r.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialogOpen()) {
        setOpen(false);
        button.current?.focus();
      }
    };
    // Close the menu once a dialog opened from it has closed (or been removed, as <ConfirmForm> does).
    let hadDialog = false;
    const watch = new MutationObserver(() => {
      const now = dialogOpen();
      if (hadDialog && !now) setOpen(false);
      hadDialog = now;
    });
    watch.observe(r, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    r.querySelector<HTMLElement>("[data-menu-panel] button, [data-menu-panel] a")?.focus();
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      watch.disconnect();
    };
  }, [open]);

  return (
    <div ref={root} className="relative z-[2] inline-block">
      <button
        ref={button}
        type="button"
        className="more-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label ?? t("common.more")}
        title={label ?? t("common.more")}
        onClick={() => setOpen((o) => !o)}
        data-testid={testId}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden>
          <circle cx="4" cy="10" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="16" cy="10" r="1.7" />
        </svg>
      </button>
      {open && (
        <div
          data-menu-panel
          className="menu-panel absolute right-0 top-full z-30 mt-1 w-max min-w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-1 text-left shadow-xl"
          // Links close the menu as they navigate; dialogs close it when they close.
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A menu item that asks before it runs a destructive action (delete…). */
export function MenuConfirm({
  action,
  name,
  value,
  message,
  label,
  icon,
  testId,
}: {
  action: (fd: FormData) => void | Promise<void>;
  name: string;
  value: string;
  message: string;
  label: string;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <ConfirmForm action={action} message={message} confirmLabel={label}>
      <input type="hidden" name={name} value={value} />
      <button className="menu-item menu-item-danger" data-testid={testId}>
        {icon && <span className="menu-icon" aria-hidden>{icon}</span>}
        {label}
      </button>
    </ConfirmForm>
  );
}
