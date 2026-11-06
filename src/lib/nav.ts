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
