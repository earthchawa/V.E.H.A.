"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

/** Re-renders the current server page every few seconds (while the tab is visible), with a small "live" note. */
export function LiveRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" data-testid="live-refresh">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
      {t("qz.live", { n: seconds })}
    </span>
  );
}
