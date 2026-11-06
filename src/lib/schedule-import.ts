import { parseCsv } from "./csv";
import type { Msg } from "./i18n";

const msg = (key: Msg["key"], vars?: Msg["vars"]): Msg => ({ key, vars });

/**
 * One line of a teaching schedule: which course runs in which term and section, and who teaches it.
 * Columns: year, semester, code, title_th, title_en, credits, section, instructors.
 * Only year, semester, code and instructors are required; titles/credits are used when the course
 * does not exist yet. Instructors are usernames separated by spaces, commas, semicolons or "|".
 */
export type ScheduleRow = {
  line: number;
  academicYear: number;
  semester: 1 | 2 | 3;
  code: string;
  titleTh: string | null;
  titleEn: string | null;
  credits: number | null;
  section: string;
  instructors: string[];
};

const CODE_RE = /^[A-Z]{2,4}\d{3}[A-Z]?$/;
const USER_RE = /^[A-Za-z0-9._-]{3,32}$/;

/** Thai subject prefixes used in the curriculum book and timetables → the codes used here. */
export const THAI_CODE_PREFIX: Record<string, string> = { คต: "CS", คณ: "MA", ฟส: "PH", คม: "CH" };

/** "CS 231", "cs231", "คต 231" → "CS231". */
export function normaliseCourseCode(raw: string): string {
  const compact = raw.replace(/\s+/g, "");
  const thai = Object.keys(THAI_CODE_PREFIX).find((p) => compact.startsWith(p));
  return (thai ? THAI_CODE_PREFIX[thai] + compact.slice(thai.length) : compact).toUpperCase();
}

/** Letters at the start of a course code: the subject area it belongs to (CS231 → CS). */
export const codeArea = (code: string) => code.match(/^[A-Z]+/)?.[0] ?? "";

export function parseSchedule(text: string): { rows: ScheduleRow[]; errors: Msg[] } {
  const rows: ScheduleRow[] = [];
  const errors: Msg[] = [];
  const seen = new Set<string>();
  parseCsv(text).forEach((cols, idx) => {
    const line = idx + 1;
    const [yearRaw = "", semRaw = "", codeRaw = "", titleTh = "", titleEn = "", creditsRaw = "", sectionRaw = "", instRaw = ""] = cols.map((c) => c.trim());
    if (cols.every((c) => !c.trim())) return;
    if (idx === 0 && /^(year|academic|ปี)/i.test(yearRaw)) return; // header row

    const academicYear = Number(yearRaw);
    if (!Number.isInteger(academicYear) || academicYear < 2500 || academicYear > 2700) {
      errors.push(msg("sched.badYear", { line, value: yearRaw }));
      return;
    }
    const semester = Number(semRaw);
    if (![1, 2, 3].includes(semester)) { errors.push(msg("sched.badSemester", { line, value: semRaw })); return; }
    const code = normaliseCourseCode(codeRaw);
    if (!CODE_RE.test(code)) { errors.push(msg("sched.badCode", { line, value: codeRaw })); return; }
    const credits = creditsRaw ? Number(creditsRaw) : null;
    if (credits != null && !(Number.isInteger(credits) && credits >= 0 && credits <= 12)) {
      errors.push(msg("sched.badCredits", { line, value: creditsRaw }));
      return;
    }
    const section = sectionRaw || "1";
    if (!/^[A-Za-z0-9-]{1,8}$/.test(section)) { errors.push(msg("sched.badSection", { line, value: sectionRaw })); return; }
    const instructors = [...new Set(instRaw.split(/[\s,;|]+/).filter(Boolean))];
    const bad = instructors.find((u) => !USER_RE.test(u));
    if (bad) { errors.push(msg("sched.badUser", { line, value: bad })); return; }
    if (!instructors.length) { errors.push(msg("sched.noInstructor", { line })); return; }
    const key = `${academicYear}/${semester}/${code}/${section}`;
    if (seen.has(key)) { errors.push(msg("sched.duplicate", { line, value: `${code} ${academicYear}/${semester} sec ${section}` })); return; }
    seen.add(key);
    rows.push({
      line,
      academicYear,
      semester: semester as 1 | 2 | 3,
      code,
      titleTh: titleTh || null,
      titleEn: titleEn || null,
      credits,
      section,
      instructors,
    });
  });
  return { rows, errors };
}
