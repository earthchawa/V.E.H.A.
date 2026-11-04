"use client";

import { level } from "@/lib/similarity/level";
import { useI18n } from "@/lib/i18n/client";

const STYLE = {
  low: "bg-emerald-500/10 text-success",
  medium: "bg-amber-500/10 text-warning",
  high: "bg-red-500/10 text-danger",
} as const;

export function SimilarityBadge({ score, showLevel = false }: { score: number | null | undefined; showLevel?: boolean }) {
  const { t, pct } = useI18n();
  if (score == null) return <span className="text-subtle">—</span>;
  const lv = level(score);
  return (
    <span className={`badge font-mono ${STYLE[lv]}`} data-testid="similarity">
      {pct(score)}
      {showLevel && <span className="ml-1 font-sans">· {t(`rep.level.${lv}`)}</span>}
    </span>
  );
}
