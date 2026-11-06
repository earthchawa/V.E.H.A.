import { describe, expect, it } from "vitest";
import { checkAll } from "./engine";
import { referenceContent } from "./sources";

const prose = (s: string) => ({ content: s, segments: [{ s: 0, e: s.length, kind: "text" as const }] });

describe("reference library", () => {
  const web = "A linked list is a linear data structure in which elements are not stored at contiguous memory locations but linked using pointers";
  const subs = [
    { id: "a", ...prose(`My answer. ${web}. That is all I know about it.`) },
    { id: "b", ...prose("Arrays keep their elements next to each other in memory, so indexing is constant time, while inserting in the middle needs shifting.") },
  ];

  it("counts reference matches one way and in the overall score", () => {
    const ref = { id: "src1|", ...referenceContent(web, []) };
    const out = checkAll(subs, null, { refs: [ref] });
    expect(out.matches).toHaveLength(0);
    expect(out.refMatches).toHaveLength(1);
    expect(out.refMatches[0].subId).toBe("a");
    expect(out.refMatches[0].score).toBeGreaterThan(0.5);
    expect(out.similarity.get("a")).toBeCloseTo(out.refMatches[0].score, 5);
    expect(out.similarity.get("b")).toBe(0);
  });

  it("starter text is ignored for references too", () => {
    const ref = { id: "src1|", ...referenceContent(web, []) };
    const out = checkAll(subs, web, { refs: [ref] });
    expect(out.refMatches).toHaveLength(0);
  });

  it("pasted reference text also matches code submissions", () => {
    const code = "def reverse(head):\n    prev = None\n    while head:\n        nxt = head.next\n        head.next = prev\n        prev = head\n        head = nxt\n    return prev\n";
    const renamed = code.replace(/head/g, "node").replace(/prev/g, "before");
    const sub = { id: "c", content: renamed, segments: [{ s: 0, e: renamed.length, kind: "code" as const }] };
    const out = checkAll([sub], null, { refs: [{ id: "gh|", ...referenceContent(code, []) }] });
    expect(out.refMatches[0]?.score ?? 0).toBeGreaterThan(0.8);
  });
});
