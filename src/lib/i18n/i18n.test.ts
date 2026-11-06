import { describe, expect, it } from "vitest";
import { en } from "./en";
import { th } from "./th";
import { makeTranslator } from ".";

describe("i18n", () => {
  it("Thai dictionary uses the same placeholders as English", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect([k, ph(th[k])]).toEqual([k, ph(en[k])]);
  });
  it("interpolates, pluralises and formats terms", () => {
    const e = makeTranslator("en");
    expect(e.tn("dash.count", 1)).toBe("1 course this semester");
    expect(e.tn("dash.count", 3)).toBe("3 courses this semester");
    expect(e.term({ academicYear: 2569, semester: 3 })).toBe("Summer 2569");
    expect(makeTranslator("th").term({ academicYear: 2569, semester: 2 })).toBe("ภาคเรียนที่ 2/2569");
  });
});
