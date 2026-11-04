"use client";

import { useState } from "react";
import Link from "next/link";
import type { Piece } from "@/lib/similarity/highlight";
import { useI18n } from "@/lib/i18n/client";
import { HighlightedContent } from "./HighlightedContent";

export type ReportSource = { label: string; share: number; compareHref?: string };

/** Interactive report: source list on the side, click a source to show only its highlights. */
export function ReportView({ pieces, sources }: { pieces: Piece[]; sources: ReportSource[] }) {
  const { t, pct } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const labels = sources.map((s) => s.label);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section className="card min-w-0 lg:order-1">
        <h2 className="card-title">{t("rep.content")}</h2>
        {pieces.length ? (
          <HighlightedContent pieces={pieces} labels={labels} active={active} />
        ) : (
          <p className="text-sm text-muted">{t("rep.noContent")}</p>
        )}
      </section>
      <aside className="lg:order-2">
        <section className="card lg:sticky lg:top-20">
          <h2 className="card-title">{t("rep.sources")}</h2>
          {sources.length === 0 ? (
            <p className="text-sm text-muted">{t("rep.noMatches")}</p>
          ) : (
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${active == null ? "bg-surface-3" : "hover:bg-surface-2"}`}
                >
                  {t("rep.allSources")}
                </button>
              </li>
              {sources.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setActive(active === i ? null : i)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${active === i ? "bg-surface-3" : "hover:bg-surface-2"}`}
                    data-testid="source"
                  >
                    <span className={`sw-${i % 6} h-2.5 w-2.5 shrink-0 rounded-full`} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="font-mono text-xs text-muted">{pct(s.share)}</span>
                  </button>
                  {s.compareHref && active === i && (
                    <Link href={s.compareHref} className="ml-7 text-xs text-accent hover:underline">{t("asg.compare")} →</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
