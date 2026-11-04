/** Pure gradebook maths, shared by server pages, the client grid and CSV export. */

export type ScaleRow = { letter: string; min: number };

/** Academy default (Thai university convention). */
export const DEFAULT_SCALE: ScaleRow[] = [
  { letter: "A", min: 80 },
  { letter: "B+", min: 75 },
  { letter: "B", min: 70 },
  { letter: "C+", min: 65 },
  { letter: "C", min: 60 },
  { letter: "D+", min: 55 },
  { letter: "D", min: 50 },
  { letter: "F", min: 0 },
];

const GRADE_POINTS: Record<string, number> = { A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, "D+": 1.5, D: 1, F: 0 };
export const gradePoints = (letter: string | null): number | null => (letter && letter in GRADE_POINTS ? GRADE_POINTS[letter] : null);

export function normaliseScale(raw: unknown): ScaleRow[] {
  if (!Array.isArray(raw)) return DEFAULT_SCALE;
  const rows = raw
    .filter((r): r is ScaleRow => !!r && typeof r.letter === "string" && typeof r.min === "number" && r.letter.trim() !== "")
    .map((r) => ({ letter: r.letter.trim().slice(0, 4), min: Math.max(0, Math.min(100, r.min)) }))
    .sort((a, b) => b.min - a.min);
  return rows.length ? rows : DEFAULT_SCALE;
}

/** Letter for a percentage (0–100). Rounds to 2 decimals first so 79.996 → 80 → A. */
export function letterFor(pct: number | null, scale: ScaleRow[] = DEFAULT_SCALE): string | null {
  if (pct == null) return null;
  const p = Math.round(pct * 100) / 100;
  return scale.find((r) => p >= r.min)?.letter ?? scale[scale.length - 1]?.letter ?? null;
}

export type GCategory = { id: string; name: string; weight: number };
export type GItem = { id: string; categoryId: string | null; maxPoints: number; isReleased: boolean };
export type CategoryResult = GCategory & { earned: number; possible: number; pct: number | null };
export type StudentResult = { categories: CategoryResult[]; totalPct: number | null; letter: string | null };

/**
 * Running grade for one cadet. Blank (null) scores don't count — enter 0 for missing work.
 * With categories: weighted average over categories that have at least one graded item
 * (items without a category are ignored). Without categories: total points / total possible.
 */
export function computeStudent(
  categories: GCategory[],
  items: GItem[],
  points: Map<string, number | null | undefined>,
  opts: { releasedOnly?: boolean; scale?: ScaleRow[] } = {},
): StudentResult {
  const counted = items.filter((i) => (!opts.releasedOnly || i.isReleased) && typeof points.get(i.id) === "number" && i.maxPoints > 0);

  if (categories.length === 0) {
    const earned = counted.reduce((n, i) => n + (points.get(i.id) as number), 0);
    const possible = counted.reduce((n, i) => n + i.maxPoints, 0);
    const totalPct = possible > 0 ? (earned / possible) * 100 : null;
    return { categories: [], totalPct, letter: letterFor(totalPct, opts.scale) };
  }

  const results: CategoryResult[] = categories.map((c) => {
    const mine = counted.filter((i) => i.categoryId === c.id);
    const earned = mine.reduce((n, i) => n + (points.get(i.id) as number), 0);
    const possible = mine.reduce((n, i) => n + i.maxPoints, 0);
    return { ...c, earned, possible, pct: possible > 0 ? (earned / possible) * 100 : null };
  });
  const graded = results.filter((r) => r.pct != null && r.weight > 0);
  const weightSum = graded.reduce((n, r) => n + r.weight, 0);
  const totalPct = weightSum > 0 ? graded.reduce((n, r) => n + r.weight * (r.pct as number), 0) / weightSum : null;
  return { categories: results, totalPct, letter: letterFor(totalPct, opts.scale) };
}

export const formatPct = (p: number | null | undefined) => (p == null ? "—" : `${(Math.round(p * 10) / 10).toFixed(1)}%`);
export const formatPoints = (p: number | null | undefined) => (p == null ? "—" : String(Math.round(p * 100) / 100));
