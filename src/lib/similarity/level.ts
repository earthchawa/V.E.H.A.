export type Level = "low" | "medium" | "high";

/** Review thresholds for overall similarity. */
export function level(score: number): Level {
  return score >= 0.4 ? "high" : score >= 0.15 ? "medium" : "low";
}
