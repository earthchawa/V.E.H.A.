"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/** Hamburger menu for narrow screens: the site navigation and account links drop down under the header. */
export function MobileMenu({ label, closeLabel, children }: { label: string; closeLabel: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? closeLabel : label}
        className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-surface-3 hover:text-fg"
        data-testid="menu-toggle"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />}
        </svg>
      </button>
      {/* Portalled to <body>: the header's backdrop blur would otherwise trap these fixed layers inside it. */}
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 top-14 z-30 bg-bg/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden />
            <div
              id="mobile-menu"
              className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border bg-bg px-4 py-3 shadow-2xl lg:hidden"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setOpen(false);
              }}
              data-testid="mobile-menu"
            >
              {children}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
