export const ROLE_LABEL = { ADMIN: "ผู้ดูแลระบบ", INSTRUCTOR: "อาจารย์", STUDENT: "นักเรียน" } as const;

export function termLabel(t: { academicYear: number; semester: number }): string {
  return t.semester === 3 ? `ภาคฤดูร้อน ${t.academicYear}` : `ภาคเรียนที่ ${t.semester}/${t.academicYear}`;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}
