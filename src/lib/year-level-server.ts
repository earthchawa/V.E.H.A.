import { db } from "./db";

/** The academic year year-level records are read and written for: the current semester's, else the latest one's. */
export async function currentAcademicYear(): Promise<number> {
  const term =
    (await db.term.findFirst({ where: { isCurrent: true }, select: { academicYear: true } })) ??
    (await db.term.findFirst({ orderBy: [{ academicYear: "desc" }], select: { academicYear: true } }));
  if (term) return term.academicYear;
  // No semesters yet: the Buddhist-era year in Bangkok.
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date())) + 543;
}

/** Set (or clear, with null) a cadet's year level for one academic year. Returns the previous level. */
export async function setYearLevel(userId: string, academicYear: number, yearLevel: number | null): Promise<number | null> {
  const key = { userId_academicYear: { userId, academicYear } };
  const before = (await db.cadetYear.findUnique({ where: key }))?.yearLevel ?? null;
  if (before === yearLevel) return before;
  if (yearLevel == null) await db.cadetYear.delete({ where: key });
  else await db.cadetYear.upsert({ where: key, create: { userId, academicYear, yearLevel }, update: { yearLevel } });
  return before;
}
