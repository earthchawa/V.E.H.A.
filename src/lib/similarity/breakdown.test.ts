import { describe, expect, it } from "vitest";
import { shareByKind } from "./breakdown";

describe("shareByKind", () => {
  const content = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
  const seg = [{ s: 0, e: content.length, kind: "text" as const }];
  const at = (word: string): [number, number] => [content.indexOf(word), content.indexOf(word) + word.length];

  it("splits coverage by kind, each on its own", () => {
    const r = shareByKind(content, seg, [
      { kind: "peer", spans: [[at("alpha")[0], at("epsilon")[1]]] }, // 5 of 10 words
      { kind: "document", spans: [[at("delta")[0], at("zeta")[1]]] }, // 3 of 10, overlapping the peer part
    ]);
    expect(r.peer).toBeCloseTo(0.5);
    expect(r.document).toBeCloseTo(0.3);
    expect(r.past).toBe(0);
  });

  it("empty content is all zero", () => {
    expect(shareByKind("", [], [{ kind: "peer", spans: [[0, 5]] }])).toEqual({ peer: 0, past: 0, document: 0 });
  });
});
