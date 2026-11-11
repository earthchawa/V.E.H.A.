"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, block = false }: { href: string; children: React.ReactNode; block?: boolean }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/courses") : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`${block ? "block px-3 py-2.5" : "whitespace-nowrap px-2 py-1.5 xl:px-2.5"} rounded-md text-sm transition ${
        active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}
