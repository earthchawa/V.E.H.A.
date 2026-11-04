import type { Segment, SegmentKind, Span } from "./engine";

export type Piece = { text: string; kind: SegmentKind; sources: number[] };

/**
 * Cut `content` into pieces at every segment and span boundary, recording which sources
 * (index into `spansBySource`) cover each piece. Rendering then just maps pieces to <mark>s.
 */
export function buildPieces(content: string, segments: Segment[], spansBySource: Span[][]): Piece[] {
  const cuts = new Set<number>([0, content.length]);
  for (const s of segments) cuts.add(s.s).add(s.e);
  for (const spans of spansBySource) for (const [a, b] of spans) cuts.add(a).add(b);
  const points = [...cuts].filter((p) => p >= 0 && p <= content.length).sort((a, b) => a - b);

  const sorted = spansBySource.map((spans) => [...spans].sort((x, y) => x[0] - y[0]));
  const ptr = sorted.map(() => 0);
  let segIdx = 0;
  const pieces: Piece[] = [];

  for (let i = 0; i + 1 < points.length; i++) {
    const [start, end] = [points[i], points[i + 1]];
    if (start === end) continue;
    while (segIdx < segments.length - 1 && segments[segIdx].e <= start) segIdx++;
    const seg = segments[segIdx];
    const kind: SegmentKind = seg && seg.s <= start && start < seg.e ? seg.kind : "meta";

    const sources: number[] = [];
    sorted.forEach((spans, src) => {
      while (ptr[src] < spans.length && spans[ptr[src]][1] <= start) ptr[src]++;
      const sp = spans[ptr[src]];
      if (sp && sp[0] <= start && end <= sp[1]) sources.push(src);
    });

    const prev = pieces[pieces.length - 1];
    if (prev && prev.kind === kind && prev.sources.join() === sources.join()) prev.text += content.slice(start, end);
    else pieces.push({ text: content.slice(start, end), kind, sources });
  }
  return pieces;
}
