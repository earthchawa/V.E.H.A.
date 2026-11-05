import { describe, expect, it } from "vitest";
import { auditQuery, auditWhere, bangkokDay, categoryOf, parseAuditFilter } from "./audit-filter";
import { en } from "./i18n/en";

describe("audit filter", () => {
  it("puts every logged action in a category with a label", () => {
    const actions = Object.keys(en).filter((k) => k.startsWith("log.")).map((k) => k.slice(4));
    expect(actions.length).toBeGreaterThan(50);
    for (const a of actions) expect(categoryOf(a), a).not.toBeNull();
    expect(categoryOf("login.failed")).toBe("auth");
    expect(categoryOf("submission.created")).toBe("assignments");
  });

  it("parses and sanitises query params", () => {
    const f = parseAuditFilter({ cat: "grades", from: "2026-11-01", to: "bad", page: "3", q: "  6601  ", problems: "1" });
    expect(f).toMatchObject({ category: "grades", from: "2026-11-01", to: "", page: 3, q: "6601", problems: true });
    expect(parseAuditFilter({ cat: "nope", page: "-2" })).toMatchObject({ category: null, page: 1 });
  });

  it("uses Bangkok days for date ranges", () => {
    const w = auditWhere(parseAuditFilter({ from: "2026-11-05", to: "2026-11-05" }), null);
    expect(JSON.stringify(w)).toContain("2026-11-04T17:00:00.000Z");
    expect(JSON.stringify(w)).toContain("2026-11-05T17:00:00.000Z");
    expect(bangkokDay(new Date("2026-11-04T18:00:00Z"))).toBe("2026-11-05");
  });

  it("scopes to the department ids given", () => {
    expect(auditWhere(parseAuditFilter({}), ["a", "b"])).toEqual({ AND: [{ departmentId: { in: ["a", "b"] } }] });
    expect(auditWhere(parseAuditFilter({}), null)).toEqual({});
  });

  it("builds links that reset the page", () => {
    const f = parseAuditFilter({ cat: "auth", page: "4", dept: "d1" });
    expect(auditQuery(f, { category: "grades" })).toBe("?cat=grades&dept=d1");
    expect(auditQuery(f, { page: 5 })).toBe("?cat=auth&dept=d1&page=5");
  });
});
