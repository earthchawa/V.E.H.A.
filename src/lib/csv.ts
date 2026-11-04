/** Minimal CSV parser (RFC 4180 quoting) — enough for spreadsheet exports from Excel / Google Sheets. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r.map((v) => {
        const s = v == null ? "" : String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    )
    .join("\r\n");
}

export type UserImportRow = {
  line: number;
  username: string;
  fullName: string;
  role: "ADMIN" | "INSTRUCTOR" | "STUDENT";
  email: string | null;
};

const ROLE_ALIASES: Record<string, UserImportRow["role"]> = {
  student: "STUDENT", นักเรียน: "STUDENT", นนอ: "STUDENT", "นนอ.": "STUDENT",
  instructor: "INSTRUCTOR", teacher: "INSTRUCTOR", อาจารย์: "INSTRUCTOR",
  admin: "ADMIN", ผู้ดูแลระบบ: "ADMIN",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

/**
 * Columns: username, fullName, role (optional, default student), email (optional).
 * A header row is detected and skipped.
 */
export function parseUserImport(text: string): { rows: UserImportRow[]; errors: string[] } {
  const rows: UserImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  parseCsv(text).forEach((cols, idx) => {
    const line = idx + 1;
    const [username = "", fullName = "", roleRaw = "", emailRaw = ""] = cols;
    if (idx === 0 && /^(username|id|student_?id|รหัส.*)$/i.test(username)) return;

    if (!USERNAME_RE.test(username)) {
      errors.push(`บรรทัด ${line}: รหัสประจำตัว "${username}" ไม่ถูกต้อง (ใช้ A-Z 0-9 . _ - ยาว 3–32 ตัว)`);
      return;
    }
    if (!fullName) { errors.push(`บรรทัด ${line}: ไม่มีชื่อ-นามสกุล`); return; }
    const role = roleRaw ? ROLE_ALIASES[roleRaw.toLowerCase()] ?? (roleRaw.toUpperCase() as UserImportRow["role"]) : "STUDENT";
    if (!["ADMIN", "INSTRUCTOR", "STUDENT"].includes(role)) {
      errors.push(`บรรทัด ${line}: บทบาท "${roleRaw}" ไม่ถูกต้อง`);
      return;
    }
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !EMAIL_RE.test(email)) { errors.push(`บรรทัด ${line}: อีเมล "${emailRaw}" ไม่ถูกต้อง`); return; }
    if (seen.has(username)) { errors.push(`บรรทัด ${line}: รหัส ${username} ซ้ำในไฟล์`); return; }
    seen.add(username);
    rows.push({ line, username, fullName, role, email });
  });
  return { rows, errors };
}
