"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * GET-style filter form that applies itself: selects at once, text after a short pause. Uses client
 * navigation so the search box keeps focus while typing. Other query parameters (e.g. a tab) are kept.
 */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const apply = () => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of new FormData(form.current!)) {
      if (typeof v !== "string") continue;
      if (v.trim()) next.set(k, v.trim());
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  };
  return (
    <form
      ref={form}
      className={className}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={(e) => {
        if (timer.current) clearTimeout(timer.current);
        if ((e.target as HTMLElement).tagName === "SELECT") apply();
        else timer.current = setTimeout(apply, 350);
      }}
    >
      {children}
    </form>
  );
}
