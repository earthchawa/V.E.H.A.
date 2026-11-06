/**
 * Logical parent of an app page, used by the Back button when there is no in-app history
 * (a page opened from a link or bookmark). Some URL levels have no page of their own
 * (…/report, …/attempts, …/grade, /admin/offerings), so those are skipped.
 */
export function parentPath(path: string): string | null {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return null;
  const seg = p.split("/").filter(Boolean);
  const join = (n: number) => "/" + seg.slice(0, n).join("/");

  if (seg[0] === "courses") {
    // /courses/[id]/quizzes/[qid]/(attempts|grade)/[x] → the quiz's results
    if (seg[2] === "quizzes" && (seg[4] === "attempts" || seg[4] === "grade")) return join(4) + "/results";
    // /courses/[id]/assignments/[aid]/report/[sid] → the assignment
    if (seg[2] === "assignments" && seg[4] === "report") return join(4);
    if (seg.length <= 2) return "/";
    return join(seg.length - 1);
  }
  if (seg[0] === "admin") {
    if (seg[1] === "offerings") return "/admin/courses";
    return seg.length > 2 ? join(2) : "/";
  }
  return seg.length > 1 ? join(seg.length - 1) : "/";
}

/** Pages reached straight from the top menu: there is nothing to go "back" to, so no Back button. */
export const NAV_ROOTS = ["/", "/account", "/admin/users", "/admin/courses", "/admin/departments", "/admin/exam-settings", "/admin/audit"];
export const isNavRoot = (path: string) => NAV_ROOTS.includes(path.replace(/\/+$/, "") || "/");

/** What the Back button returns to, for a label like "Back to the assignment". */
export type BackTarget = "dashboard" | "assignments" | "assignment" | "quizzes" | "quiz" | "results" | "semesters" | "page";
export function backTarget(path: string): BackTarget {
  const parent = parentPath(path);
  if (!parent || parent === "/") return "dashboard";
  const seg = parent.split("/").filter(Boolean);
  if (seg[0] === "courses") {
    if (seg.length === 3 && seg[2] === "assignments") return "assignments";
    if (seg.length === 4 && seg[2] === "assignments") return "assignment";
    if (seg.length === 3 && seg[2] === "quizzes") return "quizzes";
    if (seg.length === 4 && seg[2] === "quizzes") return "quiz";
    if (seg[4] === "results") return "results";
  }
  if (parent === "/admin/courses") return "semesters";
  return "page";
}

/** Course pages below the tabs (an assignment, a report, quiz results…): Back sits under the tabs there. */
export const isCourseDetail = (path: string) => /^\/courses\/[^/]+\/(assignments|quizzes)\/[^/]+/.test(path);
