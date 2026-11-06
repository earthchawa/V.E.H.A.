import { describe, expect, it } from "vitest";
import { isNavRoot, parentPath } from "./nav";

describe("parentPath", () => {
  it.each([
    ["/", null],
    ["/account", "/"],
    ["/courses/c1", "/"],
    ["/courses/c1/assignments", "/courses/c1"],
    ["/courses/c1/assignments/a1", "/courses/c1/assignments"],
    ["/courses/c1/assignments/a1/report/s1", "/courses/c1/assignments/a1"],
    ["/courses/c1/assignments/a1/compare", "/courses/c1/assignments/a1"],
    ["/courses/c1/quizzes/q1", "/courses/c1/quizzes"],
    ["/courses/c1/quizzes/q1/results", "/courses/c1/quizzes/q1"],
    ["/courses/c1/quizzes/q1/attempts/t1", "/courses/c1/quizzes/q1/results"],
    ["/courses/c1/quizzes/q1/grade/x1", "/courses/c1/quizzes/q1/results"],
    ["/admin/users", "/"],
    ["/admin/offerings/o1", "/admin/courses"],
  ])("%s → %s", (path, parent) => expect(parentPath(path)).toBe(parent));

  it("menu pages have no Back button", () => {
    expect(isNavRoot("/admin/users")).toBe(true);
    expect(isNavRoot("/admin/courses/")).toBe(true);
    expect(isNavRoot("/admin/offerings/o1")).toBe(false);
    expect(isNavRoot("/courses/c1")).toBe(false);
  });
});
