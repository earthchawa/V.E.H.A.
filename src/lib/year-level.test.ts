import { describe, expect, it } from "vitest";
import { parseYearLevel, planPromotion } from "./year-level";

describe("parseYearLevel", () => {
  it("reads plain and labelled year levels", () => {
    expect(parseYearLevel("3")).toBe(3);
    expect(parseYearLevel(" ชั้นปีที่ 2 ")).toBe(2);
    expect(parseYearLevel("ปี 4")).toBe(4);
    expect(parseYearLevel("Year 1")).toBe(1);
  });
  it("rejects anything else", () => {
    expect(parseYearLevel("")).toBeNull();
    expect(parseYearLevel("0")).toBeNull();
    expect(parseYearLevel("6")).toBeNull();
    expect(parseYearLevel("12")).toBeNull();
    expect(parseYearLevel("CS")).toBeNull();
  });
});

describe("planPromotion", () => {
  const year = [
    { userId: "a", yearLevel: 1 },
    { userId: "b", yearLevel: 3 },
    { userId: "c", yearLevel: 4 },
    { userId: "d", yearLevel: 2 },
  ];
  it("moves everyone up and graduates the final year", () => {
    const p = planPromotion(year, [], 4);
    expect(p.promote).toEqual([
      { userId: "a", yearLevel: 2 },
      { userId: "b", yearLevel: 4 },
      { userId: "d", yearLevel: 3 },
    ]);
    expect(p.graduate).toEqual(["c"]);
    expect(p.skipped).toBe(0);
  });
  it("leaves cadets who already have a row in the next year", () => {
    const p = planPromotion(year, ["a", "c"], 4);
    expect(p.promote.map((r) => r.userId)).toEqual(["b", "d"]);
    expect(p.graduate).toEqual([]);
    expect(p.skipped).toBe(2);
  });
  it("supports a five-year programme", () => {
    expect(planPromotion(year, [], 5).graduate).toEqual([]);
  });
});
