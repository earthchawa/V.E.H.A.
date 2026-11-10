/**
 * Cadet year levels (ชั้นปี). A cadet has one CadetYear row per academic year, so moving everyone up
 * at the end of a year adds rows instead of overwriting, and the history stays.
 */
export const MAX_YEAR_LEVEL = 5;
/** The academy's programme length: cadets in this year graduate instead of moving up. */
export const DEFAULT_FINAL_YEAR = 4;
export const YEAR_LEVELS = Array.from({ length: MAX_YEAR_LEVEL }, (_, i) => i + 1);

/** "3", "ปี 3", "ชั้นปีที่ 3", "Year 3" → 3; anything else → null. */
export function parseYearLevel(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = /^(?:ชั้นปีที่|ชั้นปี|ปีที่|ปี|year|y)?\s*([1-9])$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n <= MAX_YEAR_LEVEL ? n : null;
}

export type YearRecord = { userId: string; yearLevel: number };

/**
 * What moving up from one academic year to the next does: everyone below the final year goes up one,
 * the final year graduates. Cadets who already have a row in the next year are left alone, so running
 * it twice changes nothing.
 */
export function planPromotion(current: YearRecord[], alreadyInNext: Iterable<string>, finalYear: number) {
  const done = new Set(alreadyInNext);
  const promote: YearRecord[] = [];
  const graduate: string[] = [];
  let skipped = 0;
  for (const r of current) {
    if (done.has(r.userId)) skipped++;
    else if (r.yearLevel >= finalYear) graduate.push(r.userId);
    else promote.push({ userId: r.userId, yearLevel: r.yearLevel + 1 });
  }
  return { promote, graduate, skipped };
}
