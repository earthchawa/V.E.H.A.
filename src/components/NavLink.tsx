"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/courses") : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1.5 text-sm transition ${
        active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}
