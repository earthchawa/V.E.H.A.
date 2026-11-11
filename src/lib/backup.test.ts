import { describe, expect, it } from "vitest";
import { restoreOrder, tarHeader, tarPadding } from "./backup";

describe("restoreOrder", () => {
  it("puts parents before children and ignores self-references", () => {
    const order = restoreOrder(
      ["Enrollment", "User", "Department", "CourseOffering", "Course"],
      [
        { child: "User", parent: "Department" },
        { child: "Department", parent: "Department" },
        { child: "Course", parent: "Department" },
        { child: "CourseOffering", parent: "Course" },
        { child: "Enrollment", parent: "User" },
        { child: "Enrollment", parent: "CourseOffering" },
      ],
    );
    const at = (t: string) => order.indexOf(t);
    expect(at("Department")).toBeLessThan(at("User"));
    expect(at("Course")).toBeLessThan(at("CourseOffering"));
    expect(at("CourseOffering")).toBeLessThan(at("Enrollment"));
    expect(at("User")).toBeLessThan(at("Enrollment"));
    expect(order).toHaveLength(5);
  });
  it("ignores foreign keys to tables that are not in the backup", () => {
    expect(restoreOrder(["A"], [{ child: "A", parent: "Session" }])).toEqual(["A"]);
  });
  it("reports a cycle instead of looping", () => {
    expect(() => restoreOrder(["A", "B"], [{ child: "A", parent: "B" }, { child: "B", parent: "A" }])).toThrow(/circular/);
  });
});

describe("tar", () => {
  it("writes a ustar header with a valid checksum", () => {
    const h = Buffer.from(tarHeader("f/00000000-0000-0000-0000-000000000000", 1234, 0));
    expect(h.length).toBe(512);
    expect(h.toString("ascii", 0, 38)).toBe("f/00000000-0000-0000-0000-000000000000");
    expect(parseInt(h.toString("ascii", 124, 135), 8)).toBe(1234);
    expect(h.toString("ascii", 257, 262)).toBe("ustar");
    const stored = parseInt(h.toString("ascii", 148, 154), 8);
    const copy = Buffer.from(h);
    copy.fill(" ", 148, 156);
    expect([...copy].reduce((n, x) => n + x, 0)).toBe(stored);
  });
  it("pads file data to 512-byte blocks", () => {
    expect(tarPadding(0).length).toBe(0);
    expect(tarPadding(1).length).toBe(511);
    expect(tarPadding(512).length).toBe(0);
    expect(tarPadding(513).length).toBe(511);
  });
});
