export const ROLE_LABEL = { ADMIN: "Admin", INSTRUCTOR: "Instructor", STUDENT: "Cadet" } as const;

/** Academic years are Buddhist-era (e.g. 2569), as used by the academy. */
export function termLabel(t: { academicYear: number; semester: number }): string {
  return t.semester === 3 ? `Summer ${t.academicYear}` : `Semester ${t.semester}/${t.academicYear}`;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}
