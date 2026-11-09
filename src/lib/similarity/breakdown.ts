import { buildDoc, type Segment, type Span } from "./engine";

export type SourceKind = "peer" | "past" | "document";

/**
 * Share of a submission matched by each kind of source (classmates, earlier semesters, reference texts),
 * on the same token basis as the overall score. Kinds overlap, so the parts can add up to more than it.
 */
export function shareByKind(content: string, segments: Segment[], sources: { kind: SourceKind; spans: Span[] }[]): Record<SourceKind, number> {
  const tokens = buildDoc(content, segments).tokens;
  const out: Record<SourceKind, number> = { peer: 0, past: 0, document: 0 };
  if (!tokens.length) return out;
  for (const kind of ["peer", "past", "document"] as const) {
    const spans = sources.filter((s) => s.kind === kind).flatMap((s) => s.spans);
    if (!spans.length) continue;
    let covered = 0;
    for (const tok of tokens) if (spans.some(([s, e]) => tok.s < e && tok.e > s)) covered++;
    out[kind] = covered / tokens.length;
  }
  return out;
}
