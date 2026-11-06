"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n";
import { backTarget, isCourseDetail, isNavRoot, parentPath } from "@/lib/nav";

// Pages seen in this visit (module scope: survives the remounts between the app shell and course layout).
const visited: string[] = [];

/**
 * "← Back to …". In the app shell it sits above the page; inside a course it sits under the course tabs
 * and only on detail pages (the tabs already lead to each list). After moving around inside the app it
 * goes back one step in history; on a page opened directly it goes to the page's logical parent.
 */
export function BackButton({ placement }: { placement: "shell" | "course" }) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== path && visited[visited.length - 1] !== path) visited.push(path);
    last.current = path;
  }, [path]);

  const parent = parentPath(path);
  const inCourse = path.startsWith("/courses/");
  if (!parent || isNavRoot(path)) return null;
  if (placement === "shell" && inCourse) return null;
  if (placement === "course" && !isCourseDetail(path)) return null;

  const goBack = () => {
    if (visited.length > 1) {
      visited.pop();
      router.back();
    } else router.push(parent);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className={`-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition hover:bg-surface-3 hover:text-fg ${placement === "course" ? "mb-5" : "mb-4"}`}
      data-testid="back-button"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 3L5 8l5 5" />
      </svg>
      {t(`nav.backTo.${backTarget(path)}` as Key)}
    </button>
  );
}
