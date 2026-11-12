"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Small ⓘ that explains something on hover, keyboard focus or tap (phones), instead of a paragraph of
 * help text on the page. Hidden tooltips take no space, so they never widen the page.
 */
export function InfoTip({ text, align = "center", className = "" }: { text: string; align?: "center" | "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  // Above the ⓘ by default; below when there is no room above (top of the page, under the sticky header).
  const [below, setBelow] = useState(false);
  const place = () => {
    const anchor = ref.current;
    const el = tip.current;
    if (!anchor || !el) return;
    const prev = el.style.cssText;
    el.style.cssText += ";display:block;visibility:hidden";
    const height = el.offsetHeight;
    el.style.cssText = prev;
    const header = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
    setBelow(anchor.getBoundingClientRect().top - Math.max(header, 0) < height + 12);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const pos = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span ref={ref} onPointerEnter={place} onFocus={place} className={`group relative inline-flex align-middle ${className}`} data-testid="info-tip">
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        aria-label="?"
        onClick={(e) => {
          e.preventDefault(); // inside a <label>, don't focus the field
          place();
          setOpen((o) => !o);
        }}
        className="grid h-4 w-4 place-items-center rounded-full text-subtle transition hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.2v4M8 4.9v.1" strokeLinecap="round" />
        </svg>
      </button>
      <span
        ref={tip}
        id={id}
        role="tooltip"
        data-side={below ? "below" : "above"}
        className={`${open ? "block" : "hidden"} absolute ${below ? "top-full mt-2" : "bottom-full mb-2"} z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-3 px-3 py-2 text-left text-xs leading-relaxed font-normal whitespace-normal normal-case tracking-normal text-fg shadow-xl group-hover:block group-focus-within:block ${pos}`}
      >
        {text}
      </span>
    </span>
  );
}
