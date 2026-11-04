"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CourseTabs({ base, labels }: { base: string; labels: { materials: string; assignments: string; grades: string } }) {
  const path = usePathname();
  const tabs = [
    { href: base, label: labels.materials, active: path === base },
    { href: `${base}/assignments`, label: labels.assignments, active: path.startsWith(`${base}/assignments`) },
    { href: `${base}/grades`, label: labels.grades, active: path.startsWith(`${base}/grades`) },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px border-b-2 pb-2.5 text-sm transition ${
            tab.active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
