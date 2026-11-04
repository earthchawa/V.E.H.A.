import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE, computeStudent, letterFor, normaliseScale } from "./grades";

const cats = [
  { id: "hw", name: "Assignments", weight: 40 },
  { id: "mid", name: "Midterm", weight: 25 },
  { id: "fin", name: "Final", weight: 35 },
];
const items = [
  { id: "lab", categoryId: "hw", maxPoints: 10, isReleased: true },
  { id: "essay", categoryId: "hw", maxPoints: 20, isReleased: false },
  { id: "midterm", categoryId: "mid", maxPoints: 50, isReleased: true },
  { id: "final", categoryId: "fin", maxPoints: 100, isReleased: false },
];

describe("letterFor", () => {
  it("uses the Thai default scale", () => {
    expect([letterFor(80), letterFor(79.996), letterFor(55), letterFor(49.9), letterFor(null)]).toEqual(["A", "A", "D+", "F", null]);
    expect(letterFor(79.9)).toBe("B+");
  });
  it("normalises custom scales and falls back to the default", () => {
    expect(normaliseScale([{ letter: "P", min: 50 }, { letter: "F", min: 0 }])).toEqual([{ letter: "P", min: 50 }, { letter: "F", min: 0 }]);
    expect(normaliseScale("nope")).toBe(DEFAULT_SCALE);
  });
});

describe("computeStudent", () => {
  it("weights categories and ignores blank scores", () => {
    const pts = new Map<string, number | null>([["lab", 8], ["essay", 14], ["midterm", 40], ["final", null]]);
    const r = computeStudent(cats, items, pts);
    // hw = 22/30 = 73.33%, mid = 80%; final blank → excluded. (40*73.33 + 25*80) / 65 = 75.9
    expect(r.categories.find((c) => c.id === "hw")!.pct).toBeCloseTo(73.333, 2);
    expect(r.totalPct).toBeCloseTo(75.897, 2);
    expect(r.letter).toBe("B+");
  });
  it("can count only released items (cadet view)", () => {
    const pts = new Map<string, number | null>([["lab", 8], ["essay", 0], ["midterm", 40]]);
    const r = computeStudent(cats, items, pts, { releasedOnly: true });
    // hw = 8/10 (essay hidden), mid = 80% → 80
    expect(r.totalPct).toBeCloseTo(80, 5);
  });
  it("counts 0 as a score", () => {
    const r = computeStudent(cats, items, new Map([["lab", 0]]));
    expect(r.totalPct).toBe(0);
    expect(r.letter).toBe("F");
  });
  it("without categories uses total points", () => {
    const r = computeStudent([], items, new Map([["lab", 5], ["midterm", 45]]));
    expect(r.totalPct).toBeCloseTo((50 / 60) * 100, 5);
  });
  it("returns null when nothing is graded", () => {
    expect(computeStudent(cats, items, new Map()).totalPct).toBeNull();
  });
});
