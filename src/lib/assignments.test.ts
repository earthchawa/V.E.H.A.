import { describe, expect, it } from "vitest";
import { acceptsSubmissions, parseBangkokLocal, studentCanSeeReport, submissionStatus, toBangkokLocal } from "./assignments";

const now = new Date("2026-11-10T05:00:00Z");
const past = new Date("2026-11-09T00:00:00Z");
const future = new Date("2026-11-20T00:00:00Z");

describe("assignment rules", () => {
  it("round-trips Bangkok local time", () => {
    const d = parseBangkokLocal("2026-11-20T23:59")!;
    expect(d.toISOString()).toBe("2026-11-20T16:59:00.000Z");
    expect(toBangkokLocal(d)).toBe("2026-11-20T23:59");
    expect(parseBangkokLocal("garbage")).toBeNull();
  });
  it("closes after the due date unless late work is allowed", () => {
    expect(acceptsSubmissions({ dueAt: past, allowLate: false }, now)).toBe(false);
    expect(acceptsSubmissions({ dueAt: past, allowLate: true }, now)).toBe(true);
    expect(acceptsSubmissions({ dueAt: null, allowLate: false }, now)).toBe(true);
  });
  it("applies report visibility", () => {
    const base = { checkSimilarity: true, dueAt: future };
    expect(studentCanSeeReport({ ...base, reportVisibility: "IMMEDIATE" }, now)).toBe(true);
    expect(studentCanSeeReport({ ...base, reportVisibility: "AFTER_DUE" }, now)).toBe(false);
    expect(studentCanSeeReport({ ...base, dueAt: past, reportVisibility: "AFTER_DUE" }, now)).toBe(true);
    expect(studentCanSeeReport({ ...base, reportVisibility: "HIDDEN" }, now)).toBe(false);
    expect(studentCanSeeReport({ ...base, checkSimilarity: false, reportVisibility: "IMMEDIATE" }, now)).toBe(false);
  });
  it("derives submission status", () => {
    expect(submissionStatus({ dueAt: future }, null, now)).toBe("notYet");
    expect(submissionStatus({ dueAt: past }, null, now)).toBe("missing");
    expect(submissionStatus({ dueAt: past }, { isLate: true }, now)).toBe("late");
  });
});
