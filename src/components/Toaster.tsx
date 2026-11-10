"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; kind: "success" | "error"; leaving?: boolean };
const EVENT = "veha:toast";
let nextId = 1;

/** Show a short confirmation at the bottom of the screen (e.g. after a dialog saved and closed). */
export function toast(text: string, kind: Toast["kind"] = "success") {
  if (typeof window !== "undefined" && text) window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

/** Mounted once in the app shell. */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: Toast["kind"] }>).detail;
      const id = nextId++;
      setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
      setTimeout(() => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3200);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite" data-testid="toaster">
      {items.map((x) => (
        <div
          key={x.id}
          role="status"
          data-leaving={x.leaving ? "" : undefined}
          className={`toast pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border bg-surface px-4 py-2.5 text-sm shadow-xl ${
            x.kind === "error" ? "border-red-500/30 text-danger" : "border-emerald-500/30 text-fg"
          }`}
        >
          <span className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold text-white ${x.kind === "error" ? "bg-red-500" : "bg-emerald-600"}`} aria-hidden>
            {x.kind === "error" ? "!" : "✓"}
          </span>
          {x.text}
        </div>
      ))}
    </div>
  );
}
