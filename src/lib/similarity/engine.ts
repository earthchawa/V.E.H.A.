import { tokenizeCode, tokenizeText, type Token } from "./tokenize";

export type SegmentKind = "text" | "code" | "meta";
export type Segment = { s: number; e: number; kind: SegmentKind };
export type Span = [number, number];

/** Consecutive tokens that must match: ~8 words of prose, ~23 normalised code tokens (Dolos' default). */
export const K = { text: 8, code: 23 } as const;

export type Doc = {
  tokens: Token[];
  /** k-gram key → token start indices */
  grams: Map<string, number[]>;
  /** k (gram length) for the gram starting at each index */
  gramLen: Map<number, number>;
};

function addGrams(doc: Doc, tokens: Token[], kind: "text" | "code", base: number) {
  const k = K[kind];
  for (let i = 0; i + k <= tokens.length; i++) {
    const key = kind[0] + ":" + tokens.slice(i, i + k).map((t) => t.v).join(" ");
    const list = doc.grams.get(key);
    if (list) list.push(base + i);
    else doc.grams.set(key, [base + i]);
    doc.gramLen.set(base + i, k);
  }
}

export function buildDoc(content: string, segments: Segment[]): Doc {
  const doc: Doc = { tokens: [], grams: new Map(), gramLen: new Map() };
  for (const seg of segments) {
    if (seg.kind === "meta") continue;
    const slice = content.slice(seg.s, seg.e);
    const toks = seg.kind === "code" ? tokenizeCode(slice, seg.s) : tokenizeText(slice, seg.s);
    addGrams(doc, toks, seg.kind, doc.tokens.length);
    doc.tokens.push(...toks);
  }
  return doc;
}

/** k-grams of instructor-provided starter text, tokenised both as prose and as code. */
export function ignoredGrams(baseText: string | null | undefined): Set<string> {
  if (!baseText?.trim()) return new Set();
  const doc: Doc = { tokens: [], grams: new Map(), gramLen: new Map() };
  addGrams(doc, tokenizeText(baseText), "text", 0);
  addGrams(doc, tokenizeCode(baseText), "code", 0);
  return new Set(doc.grams.keys());
}

export type PairResult = { coveredA: Uint8Array; coveredB: Uint8Array; scoreA: number; scoreB: number };

export function comparePair(a: Doc, b: Doc, ignore: Set<string>): PairResult {
  const coveredA = new Uint8Array(a.tokens.length);
  const coveredB = new Uint8Array(b.tokens.length);
  for (const [key, startsA] of a.grams) {
    if (ignore.has(key)) continue;
    const startsB = b.grams.get(key);
    if (!startsB) continue;
    for (const i of startsA) coveredA.fill(1, i, i + a.gramLen.get(i)!);
    for (const j of startsB) coveredB.fill(1, j, j + b.gramLen.get(j)!);
  }
  return { coveredA, coveredB, scoreA: share(coveredA), scoreB: share(coveredB) };
}

export function share(covered: Uint8Array): number {
  if (covered.length === 0) return 0;
  let n = 0;
  for (const c of covered) n += c;
  return n / covered.length;
}

/** Merge runs of covered tokens into character spans. */
export function toSpans(tokens: Token[], covered: Uint8Array): Span[] {
  const spans: Span[] = [];
  let start = -1;
  for (let i = 0; i <= tokens.length; i++) {
    const on = i < tokens.length && covered[i] === 1;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      spans.push([tokens[start].s, tokens[i - 1].e]);
      start = -1;
    }
  }
  return spans;
}

export type CheckInput = { id: string; content: string; segments: Segment[] };
export type CheckOutput = {
  /** Union coverage per submission. */
  similarity: Map<string, number>;
  matches: { aId: string; bId: string; scoreA: number; scoreB: number; spansA: Span[]; spansB: Span[] }[];
};

/** Compare every submission with every other one (n is a class, so n² is fine). */
/** With at least this many submissions, a passage in more than half of them counts as "common". */
export const COMMON_MIN_SUBMISSIONS = 4;

export function checkAll(
  subs: CheckInput[],
  ignoreText?: string | null,
  opts: { ignoreCommon?: boolean } = {},
): CheckOutput {
  const ignore = ignoredGrams(ignoreText);
  const docs = subs.map((s) => buildDoc(s.content, s.segments));

  // Passages most of the class shares (textbook sentences, the question copied into the answer)
  // say little about copying between particular cadets.
  if (opts.ignoreCommon && subs.length >= COMMON_MIN_SUBMISSIONS) {
    const df = new Map<string, number>();
    for (const d of docs) for (const key of d.grams.keys()) df.set(key, (df.get(key) ?? 0) + 1);
    for (const [key, n] of df) if (n > subs.length / 2) ignore.add(key);
  }
  const union = docs.map((d) => new Uint8Array(d.tokens.length));
  const matches: CheckOutput["matches"] = [];

  for (let i = 0; i < subs.length; i++) {
    for (let j = i + 1; j < subs.length; j++) {
      const r = comparePair(docs[i], docs[j], ignore);
      if (r.scoreA === 0 && r.scoreB === 0) continue;
      r.coveredA.forEach((c, t) => c && (union[i][t] = 1));
      r.coveredB.forEach((c, t) => c && (union[j][t] = 1));
      matches.push({
        aId: subs[i].id,
        bId: subs[j].id,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        spansA: toSpans(docs[i].tokens, r.coveredA),
        spansB: toSpans(docs[j].tokens, r.coveredB),
      });
    }
  }
  return { similarity: new Map(subs.map((s, i) => [s.id, share(union[i])])), matches };
}

export { level, type Level } from "./level";
