import { describe, expect, it } from "vitest";
import { buildPieces } from "./highlight";

describe("buildPieces", () => {
  it("splits on overlapping spans from several sources and keeps segment kinds", () => {
    const content = "hello world\n▌ a.py\nx = 1";
    const segments = [
      { s: 0, e: 11, kind: "text" as const },
      { s: 11, e: 19, kind: "meta" as const },
      { s: 19, e: 24, kind: "code" as const },
    ];
    const pieces = buildPieces(content, segments, [[[0, 11]], [[6, 11], [19, 24]]]);
    expect(pieces).toEqual([
      { text: "hello ", kind: "text", sources: [0] },
      { text: "world", kind: "text", sources: [0, 1] },
      { text: "\n▌ a.py\n", kind: "meta", sources: [] },
      { text: "x = 1", kind: "code", sources: [1] },
    ]);
    expect(pieces.map((p) => p.text).join("")).toBe(content);
  });
});
