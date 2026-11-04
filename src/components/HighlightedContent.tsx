"use client";

import type { Piece } from "@/lib/similarity/highlight";

/** Renders analysed content with <mark>s; `active` limits highlighting to one source. */
export function HighlightedContent({
  pieces,
  labels,
  active = null,
  colorOf = (src) => src,
}: {
  pieces: Piece[];
  labels: string[];
  active?: number | null;
  colorOf?: (src: number) => number;
}) {
  // Group consecutive pieces of the same kind into blocks (prose vs code vs file header).
  const blocks: { kind: Piece["kind"]; pieces: Piece[] }[] = [];
  for (const p of pieces) {
    const last = blocks[blocks.length - 1];
    if (last && last.kind === p.kind) last.pieces.push(p);
    else blocks.push({ kind: p.kind, pieces: [p] });
  }
  const render = (p: Piece, i: number) => {
    const visible = active == null ? p.sources : p.sources.filter((s) => s === active);
    if (!visible.length) return <span key={i}>{p.text}</span>;
    return (
      <mark key={i} className={`hl hl-${colorOf(visible[0]) % 6} text-inherit`} title={visible.map((s) => labels[s]).join(", ")}>
        {p.text}
      </mark>
    );
  };
  return (
    <div className="space-y-1" data-testid="highlighted">
      {blocks.map((b, i) =>
        b.kind === "meta" ? (
          <div key={i} className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted first:mt-0 first:border-0 first:pt-0">
            {b.pieces.map((p) => p.text).join("").trim()}
          </div>
        ) : b.kind === "code" ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed">
            {b.pieces.map(render)}
          </pre>
        ) : (
          <div key={i} className="whitespace-pre-wrap text-sm leading-7">{b.pieces.map(render)}</div>
        ),
      )}
    </div>
  );
}
