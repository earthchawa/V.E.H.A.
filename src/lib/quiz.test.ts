import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { attemptDeadline, attemptTotals, autoGrade, buildLayout, ipAllowed, normaliseShort, quizPhase, resultsVisible, sebOk } from "./quiz";

const opts = [
  { id: "a", text: "A", correct: true },
  { id: "b", text: "B", correct: false },
  { id: "c", text: "C", correct: true },
  { id: "d", text: "D", correct: false },
];

describe("autoGrade", () => {
  it("single choice", () => {
    const q = { type: "SINGLE" as const, points: 2, options: [opts[0], opts[1]], accepted: [] };
    expect([autoGrade(q, { choice: ["a"] }), autoGrade(q, { choice: ["b"] }), autoGrade(q, { choice: [] }), autoGrade(q, null)]).toEqual([2, 0, 0, 0]);
  });
  it("multiple choice gives partial credit and never negative", () => {
    const q = { type: "MULTIPLE" as const, points: 4, options: opts, accepted: [] };
    expect(autoGrade(q, { choice: ["a", "c"] })).toBe(4);
    expect(autoGrade(q, { choice: ["a"] })).toBe(2);
    expect(autoGrade(q, { choice: ["a", "b"] })).toBe(0);
    expect(autoGrade(q, { choice: ["b", "d"] })).toBe(0);
  });
  it("short answer: matches accepted answers loosely, otherwise needs a person", () => {
    const q = { type: "SHORT" as const, points: 1, options: [], accepted: ["Linked List", "ลิงก์ลิสต์"] };
    expect(autoGrade(q, { text: "  linked   list. " })).toBe(1);
    expect(autoGrade(q, { text: "ลิงก์ลิสต์" })).toBe(1);
    expect(autoGrade(q, { text: "a list of links" })).toBeNull();
    expect(autoGrade(q, { text: "" })).toBe(0);
  });
  it("essay: blank = 0, otherwise manual", () => {
    const q = { type: "ESSAY" as const, points: 5, options: [], accepted: [] };
    expect(autoGrade(q, { text: " " })).toBe(0);
    expect(autoGrade(q, { text: "answer" })).toBeNull();
  });
  it("normalises Thai and English", () => {
    expect(normaliseShort(" O(N) ")).toBe("o(n)");
  });
});

describe("totals, layout and timing", () => {
  it("score is null until everything is graded", () => {
    expect(attemptTotals([{ points: 2 }, { points: null }], 10)).toMatchObject({ score: null, partial: 2, pending: 1 });
    expect(attemptTotals([{ points: 2 }, { points: 3.5 }], 10)).toMatchObject({ score: 5.5, pending: 0 });
  });
  it("shuffles deterministically with a given rng and keeps every id", () => {
    const qs = [{ id: "q1", options: opts }, { id: "q2", options: [] }, { id: "q3", options: [] }];
    let seed = 1;
    const rand = (n: number) => (seed = (seed * 7 + 3) % 101) % n;
    const l = buildLayout(qs, { shuffleQuestions: true, shuffleOptions: true }, rand);
    expect([...l.questions].sort()).toEqual(["q1", "q2", "q3"]);
    expect([...l.options.q1].sort()).toEqual(["a", "b", "c", "d"]);
    expect(buildLayout(qs, { shuffleQuestions: false, shuffleOptions: false }).questions).toEqual(["q1", "q2", "q3"]);
  });
  it("deadline is start + limit, capped at close", () => {
    const start = new Date("2026-11-10T02:00:00Z");
    const close = new Date("2026-11-10T02:30:00Z");
    expect(attemptDeadline(start, 60, close)).toEqual(close);
    expect(attemptDeadline(start, 20, close)?.toISOString()).toBe("2026-11-10T02:20:00.000Z");
    expect(attemptDeadline(start, null, null)).toBeNull();
  });
  it("phases and result visibility", () => {
    const now = new Date("2026-11-10T03:00:00Z");
    const base = { isPublished: true, opensAt: new Date("2026-11-10T02:00:00Z"), closesAt: new Date("2026-11-10T04:00:00Z") };
    expect(quizPhase({ ...base, isPublished: false }, now)).toBe("draft");
    expect(quizPhase(base, now)).toBe("open");
    expect(quizPhase(base, new Date("2026-11-10T01:00:00Z"))).toBe("upcoming");
    expect(quizPhase(base, new Date("2026-11-10T05:00:00Z"))).toBe("closed");
    expect(resultsVisible({ ...base, results: "FULL" }, now)).toEqual({ score: false, answers: false });
    expect(resultsVisible({ ...base, results: "FULL" }, new Date("2026-11-10T05:00:00Z"))).toEqual({ score: true, answers: true });
    expect(resultsVisible({ ...base, results: "SCORE" }, new Date("2026-11-10T05:00:00Z"))).toEqual({ score: true, answers: false });
  });
});

describe("access restrictions", () => {
  it("IP allow-list with CIDR", () => {
    expect(ipAllowed("10.20.5.7", "")).toBe(true);
    expect(ipAllowed("10.20.5.7", "10.20.0.0/16")).toBe(true);
    expect(ipAllowed("::ffff:10.20.5.7", "10.20.0.0/16")).toBe(true);
    expect(ipAllowed("10.21.5.7", "10.20.0.0/16\n192.168.1.10")).toBe(false);
    expect(ipAllowed("192.168.1.10", "10.20.0.0/16\n192.168.1.10")).toBe(true);
    expect(ipAllowed(null, "10.0.0.0/8")).toBe(false);
  });
  it("SEB config key hash and user-agent fallback", () => {
    const url = "https://aeroclass.example/exam/abc";
    const key = "a".repeat(64);
    const hash = createHash("sha256").update(url + key).digest("hex");
    expect(sebOk({ url, userAgent: null, configKeyHash: hash, keys: key })).toBe(true);
    expect(sebOk({ url: url + "#x", userAgent: null, configKeyHash: hash.toUpperCase(), keys: key })).toBe(true);
    expect(sebOk({ url, userAgent: "SEB/3.10", configKeyHash: "bad", keys: key })).toBe(false);
    expect(sebOk({ url, userAgent: "Mozilla/5.0 SEB/3.10.1", configKeyHash: null, keys: "" })).toBe(true);
    expect(sebOk({ url, userAgent: "Mozilla/5.0 Chrome", configKeyHash: null, keys: "" })).toBe(false);
  });
});
