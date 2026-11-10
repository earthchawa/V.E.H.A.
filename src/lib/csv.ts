import { msg, type Msg } from "./i18n";
import { parseYearLevel } from "./year-level";

/** Minimal CSV parser (RFC 4180 quoting) — enough for spreadsheet exports from Excel / Google Sheets. */
export function parseCsv(input: string): string[][] {
  // Excel's "CSV UTF-8" starts with a byte-order mark; it would otherwise stick to the first header.
  const text = input.replace(/^\uFEFF/, "");
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
  /** Department code (optional 5th column). */
  department: string | null;
  /** Starting password (optional 6th column); otherwise a random one is issued. Must still be changed at first sign-in. */
  password: string | null;
  /** Year level 1–5 for cadets (optional 7th column), recorded for the current academic year. */
  yearLevel: number | null;
};

const ROLE_ALIASES: Record<string, UserImportRow["role"]> = {
  student: "STUDENT", cadet: "STUDENT", นักเรียน: "STUDENT", นนอ: "STUDENT", "นนอ.": "STUDENT",
  instructor: "INSTRUCTOR", teacher: "INSTRUCTOR", อาจารย์: "INSTRUCTOR",
  admin: "ADMIN", ผู้ดูแลระบบ: "ADMIN",
};

/** Shortest starting password an admin may set in an import (the user must change it at first sign-in). */
export const START_PASSWORD_MIN = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

/**
 * Columns: username, fullName, role (optional, default student), email, department, password, year (all optional).
 * A header row is detected and skipped.
 */
export function parseUserImport(text: string): { rows: UserImportRow[]; errors: Msg[] } {
  const rows: UserImportRow[] = [];
  const errors: Msg[] = [];
  const seen = new Set<string>();

  parseCsv(text).forEach((cols, idx) => {
    const line = idx + 1;
    const [username = "", fullName = "", roleRaw = "", emailRaw = "", deptRaw = "", passwordRaw = "", yearRaw = ""] = cols;
    if (idx === 0 && /^(username|id|student_?id|รหัส.*)$/i.test(username)) return;

    if (!USERNAME_RE.test(username)) {
      errors.push(msg("csv.badId", { line, id: username }));
      return;
    }
    if (!fullName) { errors.push(msg("csv.noName", { line })); return; }
    const role = roleRaw ? ROLE_ALIASES[roleRaw.toLowerCase()] ?? (roleRaw.toUpperCase() as UserImportRow["role"]) : "STUDENT";
    if (!["ADMIN", "INSTRUCTOR", "STUDENT"].includes(role)) {
      errors.push(msg("csv.badRole", { line, role: roleRaw }));
      return;
    }
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !EMAIL_RE.test(email)) { errors.push(msg("csv.badEmail", { line, email: emailRaw })); return; }
    if (passwordRaw && (passwordRaw.length < START_PASSWORD_MIN || passwordRaw.length > 64 || /\s/.test(passwordRaw))) {
      errors.push(msg("csv.badPassword", { line, n: START_PASSWORD_MIN }));
      return;
    }
    const yearLevel = parseYearLevel(yearRaw);
    if (yearRaw.trim() && (yearLevel == null || role !== "STUDENT")) { errors.push(msg("csv.badYear", { line, value: yearRaw })); return; }
    if (seen.has(username)) { errors.push(msg("csv.dupId", { line, id: username })); return; }
    seen.add(username);
    rows.push({ line, username, fullName, role, email, department: deptRaw ? deptRaw.toUpperCase() : null, password: passwordRaw || null, yearLevel });
  });
  return { rows, errors };
}
