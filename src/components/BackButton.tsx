"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { parentPath } from "@/lib/nav";

/**
 * "← Back" above every app page except the dashboard. After moving around inside the app it goes back
 * one step in the browser history; on a page opened directly (link, bookmark, reload) it goes to the
 * page's logical parent instead of leaving the site.
 */
export function BackButton() {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  // The layout stays mounted across client navigations, so this counts pages seen in this visit.
  const visited = useRef<string[]>([]);
  useEffect(() => {
    if (visited.current[visited.current.length - 1] !== path) visited.current.push(path);
  }, [path]);

  const parent = parentPath(path);
  if (!parent) return null;
  const goBack = () => {
    if (visited.current.length > 1) {
      visited.current.pop();
      router.back();
    } else router.push(parent);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition hover:bg-surface-3 hover:text-fg"
      data-testid="back-button"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 3L5 8l5 5" />
      </svg>
      {t("nav.back")}
    </button>
  );
}
